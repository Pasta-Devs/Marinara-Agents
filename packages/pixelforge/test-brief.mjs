// Standalone harness for the brief validator (node test-brief.mjs): shims the
// PF prelude globals, loads the non-DOM modules, and drives the repair passes,
// compiler invariants, injection metering, and spatial-binding regressions
// through the spec's degenerate cases (docs/brief-schema.md §4-5, §7).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// ── THE HARNESS ALWAYS LEAVES (Agents #554) ──────────────────────────────────
// A red run was once seen to print an error and then sit past a ten-minute
// timeout; six later attempts could not reproduce it. What those attempts did
// settle is that the THROW path is not the one that needs a guard: node prints
// an uncaught AssertionError and exits 1 in the same tick, with timers armed or
// not, so a final catch here could only take node's own rendering of the red
// away from the workflow that reads it, and buy nothing back.
//
// The shape that can sit forever is the one that never throws. withSavePath
// stubs globalThis.setTimeout to RECORD rather than fire, six of the HUD cases
// stub it away outright, and two package paths — 60-save's brief-storage ladder
// and 58-player's quarantine one — wait on a promise that only a timer resolves.
// A case that reaches one of those parks its await, the module promise never
// settles, and node cannot report what nobody threw. With the loop drained it
// says so and exits 13; with anything still alive it simply waits, which is a
// hang with an error printed above it and no exit under it — the report exactly.
//
// So the guarantee is a deadline rather than a catch. The timer is unref'd on
// purpose: it cannot hold a healthy run open (a green run takes ~5s and is long
// gone before this comes due), and it can only fire inside a process that is
// still alive at the deadline, which is the hang and nothing else. It prints
// what the issue asked the next person to capture before killing it.
const HANG_BUDGET_MS = 120_000; // ~25x a green run; raise it if you are sitting in a debugger
const watchdog = setTimeout(() => {
  console.error(`\nharness watchdog: ${HANG_BUDGET_MS}ms and no exit — a case is parked (Agents #554).`);
  console.error("still alive:", process.getActiveResourcesInfo());
  process.exit(1);
}, HANG_BUDGET_MS);
watchdog.unref();

const here = dirname(fileURLToPath(import.meta.url));
// Mirror the real bundle: concatenate the modules into one scope (the prelude
// declares `const PF` itself) and return PF. 70-hud and 80-setup ride along
// because both hold a fact about the SURFACE that nothing else can answer for —
// where a notice lands, and what the wizard writes into the experience config —
// and neither touches the DOM until it is called (see the FakeNode shim near the
// end of this file). 40-render and 90-element stay out: a canvas context and a
// custom-element registration want a page, not a shim.
// Named rather than spelled inline because the cross-process determinism case
// hands this same list to a second interpreter, which loads the package exactly
// the way this one does.
const MODULES = [
  "00-prelude.js",
  "10-art.js",
  "15-assets.js",
  "18-brief.js",
  "20-world.js",
  "25-schedule.js",
  "30-sim.js",
  "50-spatial.js",
  "55-maps-export.js",
  "58-player.js",
  "59-economy.js",
  "60-save.js",
  "70-hud.js",
  "80-setup.js",
];
const source = MODULES.map((file) => readFileSync(join(here, "src", file), "utf8")).join("\n");
const loadedPF = new Function(`"use strict";\n${source}\nreturn PF;`)();
// refresh() fire-and-forgets the maps export; without a stub every earlier
// spatial case would hit undefined fetch and warn. 404 = "route absent" is the
// quiet-skip mode, exactly right as a default. Export cases override it.
loadedPF.api.postSpatialLocations = async () => ({ ok: false, status: 404, body: null });
// Same reasoning for the metadata PATCH: from slice 3 on, restoring a save can
// write the quarantine key, and every case that does not care about that would
// otherwise fire a real fetch at a relative URL and warn. The cases that DO care
// override it (see withSavePath, and the quarantine cases at the end).
const realPatchMetadata = loadedPF.api.patchMetadata;
loadedPF.api.patchMetadata = async () => {};
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
  // …including the one compose calls for itself. This stand-in has no player
  // block on it, which is exactly the shape `_composeLedger` answers null to, so
  // the metering below still measures the prose parts and nothing else.
  sim._composeLedger = loadedPF.Sim.prototype._composeLedger.bind(sim);
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

// 22-25. The §5 failure ladder (REVISED THIS RELEASE): NO failure seals a world.
// Truncation still re-rolls plainly and salvages the longest raw across attempts,
// because that path yields a REAL brief — but every outcome that does not is a
// retry screen with nothing stored, deterministic 400/422 included.
//
// THE REVISION, and why the pin below moved. The 0.4.0 ladder sealed themed
// defaults on a deterministic/paid failure, reasoning that a paid call per visit
// is worse than the default world. That predates the loading gate: back then the
// player was already walking in a default world, so sealing it changed nothing
// they could see. Now the gate holds play precisely so nobody invests in a world
// that will be discarded, and the README states the contract — "a generation
// failure is a retry screen; nothing is stored". Sealing on a 400 made that false
// in the one case a player cannot undo. capPreferences clamping to 7,800 against
// the route's 8,000 cap also makes a reachable 400 a contract bug rather than a
// long setting, so the paid-call worry is close to hypothetical now.
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

  // 24. Deterministic failure → NULL, unsealed, a retry screen. REVISED: this
  // pinned "provider_error seals a full brief" through 0.4.0 and 0.10, and the
  // revision is deliberate (see the header above). A deterministic verdict is
  // still a verdict the player is TOLD about, so the kind is reported once.
  for (const [label, response, kind] of [
    ["a 422 provider error", { status: 422, body: { code: "provider_error", truncated: false } }, "refused"],
    ["a 400 contract failure", { status: 400, body: { code: "user_content_too_long" } }, "refused"],
    ["a 429", { status: 429, body: null }, "unavailable"],
    ["a 503", { status: 503, body: null }, "unavailable"],
  ]) {
    stub([response]);
    const kinds = [];
    const outcome = await brief.generate("c", {
      theme: "sci-fi-colony",
      seed: 2,
      preferences: "",
      onFailure: (k) => kinds.push(k),
    });
    assert.equal(outcome, null, `${label} seals NOTHING — no default world decided on the player's behalf`);
    assert.deepEqual(kinds, [kind], `${label} reports its kind exactly once, so the retry screen can say why`);
  }
  // Truncation salvage is untouched by the revision, and this is the line that
  // says why: that path produces a REAL brief out of what the model actually
  // wrote, which is nothing like sealing a default nobody asked for.
  stub([{ status: 422, body: { truncated: true, raw: '{"scale":"village","name":"Halfway","cast":[]}' } }]);
  const stillSalvages = await brief.generate("c", { theme: "cozy-village", seed: 2, preferences: "" });
  assert.equal(stillSalvages?.name, "Halfway", "a truncated response is still salvaged and still seals");

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

  // 37c. Every id in this table belongs to the HOST — authored by hand or by
  // the wizard's map instructions — and "__proto__" is a word every plain object
  // already answers to (#567). Both halves of the binding handling broke on it,
  // and the reachable damage is not the one the issue predicted:
  //
  //   * the adoption read at the top of `_plan` (`world.bindings[adopted]`) came
  //     back Object.prototype — neither undefined nor the zone — so the adoption
  //     was refused on the FIRST sync and the export posted a TWIN of the very
  //     location it was meant to bind. Onto a player's real map, through a route
  //     with no delete, so nothing takes it back;
  //   * the write it would otherwise have reached (`bindings[locId] = zoneId`)
  //     is a silent no-op on a plain object anyway — the prototype setter takes
  //     an object or null and drops a string — which is why the refused adoption
  //     above could never heal itself on a later pass either.
  //
  // The table is null-prototype from creation now (20-world), so the id is just
  // an id: the adoption holds, the binding lands, and a later session is the
  // cheap re-bind this module's own header promises.
  //
  // ALONE AMONG THE CASES HERE, THIS ONE PUTS ITS STUBS BACK. The harness is one
  // module top to bottom, and what this case leaves on PF.api is a spatial
  // definition whose only location id is `__proto__` — a fixture no later case
  // asked for. Every case below happens to re-stub both members before it drives
  // anything, so nothing reads the leak today; the restore is what keeps that a
  // fact rather than a coincidence the next case has to re-establish (review).
  const stubsBefore37c = { getSpatial: loadedPF.api.getSpatial, postLocations: loadedPF.api.postSpatialLocations };
  try {
    const { w, core } = exportScaffold(2468, "chat-export-37c");
    const adoptedZone = exportableZones(w)[0];
    const adoptedName = w.zones[adoptedZone].name;
    const posts = [];
    let serverLocs = [{ id: "loc-root" }, { id: "__proto__", parentId: "loc-root", name: adoptedName }];
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
    assert.equal(w.bindings["__proto__"], adoptedZone, "a host location id of `__proto__` binds like any other id");
    assert.equal(w.zones[adoptedZone].spatialLocationId, "__proto__", "and the zone records the adopted id");
    assert.ok(
      !posts.flatMap((p) => p.locations).some((row) => row.name === adoptedName),
      "and no twin of it is ever posted — the row this route can never take back",
    );
    // Once, and then quiet. A later session re-plans the same world, finds the
    // binding already hung, and reports NOTHING — the cheap re-bind the module's
    // own header promises, which is what a refused adoption made impossible.
    const dirtyAfterFirst = core.dirty;
    const postsAfterFirst = posts.length;
    assert.ok(dirtyAfterFirst > 0, "the first sync is the one that persists the bindings");
    resetExportState();
    await mapsExport.maybeSync(core);
    assert.equal(core.dirty, dirtyAfterFirst, "a second sync reports no change — the binding stuck the first time");
    assert.equal(posts.length, postsAfterFirst, "…and posts nothing further");

    // The same table from the other end, and THIS is where the permanent churn
    // lives: the first binding is written by 50-spatial off `currentLocationId`,
    // which is exactly as host-owned as an authored id, and that write is
    // unconditional. Bare, it vanished — so the table stayed empty, the seeding
    // branch re-fired and re-dirtied on every single refresh, and maybeSync
    // bailed for want of a root. A world that could never export, forever.
    {
      const { w: rw, core: rcore } = exportScaffold(1357, "chat-export-37c-root");
      loadedPF.api.getSpatial = async () => ({
        definition: { revision: 1, locations: [{ id: "__proto__" }] },
        currentLocationId: "__proto__",
        breadcrumb: [{ name: "Rootville" }],
        destinations: [],
      });
      resetExportState();
      await bindRoot(rcore);
      assert.equal(rw.bindings["__proto__"], rw.startZone, "the first-seen location binds under that name too");
      assert.equal(rw.zones[rw.startZone].spatialLocationId, "__proto__", "and the exterior records it");
      const dirtyAfterSeed = rcore.dirty;
      await bindRoot(rcore);
      assert.equal(rcore.dirty, dirtyAfterSeed, "and the seeding branch never fires a second time for it");
    }
  } finally {
    loadedPF.api.getSpatial = stubsBefore37c.getSpatial;
    loadedPF.api.postSpatialLocations = stubsBefore37c.postLocations;
  }
  assert.equal(loadedPF.api.getSpatial, stubsBefore37c.getSpatial, "37c hands the spatial GET back the way it got it");
  assert.equal(
    loadedPF.api.postSpatialLocations,
    stubsBefore37c.postLocations,
    "…and the POST too, so no later case inherits a map whose only location is `__proto__`",
  );

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

// 14g. …AND THE TABLE IT READS IS READ AS AN OWN PROPERTY.
// PF.DAYPART_STARTS moved out of waitUntil's body when the fishing verb wanted
// the same four thresholds, and a shared table is a table more than one caller
// can be handed a hostile word for. `starts["constructor"]` answers with a
// FUNCTION, which is not undefined: a bare read waves it past an
// `=== undefined` guard, `clockMin` is assigned a function, and every clock read
// downstream — the chip, the daypart, the darkness pass, the save byte — goes to
// NaN on a sim that is otherwise perfectly healthy.
{
  const sim = new loadedPF.Sim(world.build(5150, "cozy-village", brief.defaults("cozy-village", 5150)));
  sim.mode = "walk";
  sim.clockMin = 10 * 60;
  sim.day = 3;
  for (const key of ["constructor", "toString", "valueOf", "hasOwnProperty", "__proto__"]) {
    assert.equal(sim.waitUntil(key), false, `"${key}" is not a daypart, whatever the prototype answers with`);
    assert.equal(sim.clockMin, 10 * 60, `…and the clock did not move for "${key}"`);
    assert.equal(sim.day, 3, `…nor the day`);
  }
  assert.equal(typeof sim.clockMin, "number", "the clock is still a number and not a function");
  assert.equal(sim.clockLabel(), "Day 3 · 10:00", "…and still renders as a time rather than NaN:NaN");
  assert.equal(sim.waitUntil("dusk"), true, "while a word the table really holds still works");
  assert.equal(sim.clockMin, 18 * 60, "…and lands where it always did");
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

// ── A WORKPLACE AND A STATION ARE DIFFERENT FACTS ──────────────────────────
// `workplace` resolves against the BRIEF's declared zones, so it always names a
// `z*`. WORK_POSTS — the strip behind a shop counter — is keyed by `special` on a
// building the COMPILER minted, which is `s*` or `h*` and has no brief name to be
// named by. Those two can never meet, and that half of the claim is unchanged.
//
// What changed in 0.11 is that a brief-declared room CAN carry a station now: the
// furnisher of a gathering records its serving row and a sanctuary's records its
// chancel, and the places pass hands it to that building's OWNER so an innkeeper
// homed at the settlement root stops standing on their own doorstep. So the cast
// loop's missing counter branch no longer rests on "a lookup here could never
// match" — it rests on the station belonging to whoever RUNS the room. A
// workplace is the one binding that puts SEVERAL people in one building, and a
// station is a single row: they would stack on it, or be pushed straight back off
// it by the occupancy scan.
//
// Pinned because the removal RELIES on that: if a future change ever sends a
// named worker to a station, this fails and whoever did it learns that the box a
// named worker stands in needs revisiting.
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
        // Named INTO the room that has a station, which is what makes the claim
        // below something other than vacuous.
        { name: "E", role: "potboy", kind: "folk", tint: "teal", home: "Probe", workplace: "The Kettle", household: 5 },
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
  const at = (name) => {
    for (const id in w.zones) if (w.zones[id].npcs.some((n) => n.name === name)) return id;
    return null;
  };
  const npcNamed = (name) =>
    Object.values(w.zones)
      .flatMap((zone) => zone.npcs)
      .find((npc) => npc.name === name);
  // THE ROOM WITH A STATION IN IT, and a worker the brief named into it.
  const kettleId = Object.entries(sealed._ids.zones).find(([, n]) => n === "The Kettle")[0];
  const kettle = w.zones[kettleId];
  assert.ok(kettle?.post, "the gathering's furnisher recorded a station of its own");
  const workerBox = npcNamed("E")._sched.post.wander;
  assert.notDeepEqual(workerBox, kettle.post, "a named worker is not sent to the keeper's station");
  assert.ok(
    workerBox.x0 < kettle.post.x0 && workerBox.y1 > kettle.post.y1,
    `a named worker gets the room's middle, strictly bigger than the station (${JSON.stringify(workerBox)})`,
  );
  // And the named workers really are inside the zones they were assigned.
  const yardsId = Object.entries(sealed._ids.zones).find(([, n]) => n === "The Yards")[0];
  const sim = new loadedPF.Sim(w);
  sim.clockMin = 12 * 60;
  sim.resolveSchedules();
  assert.equal(at("C"), yardsId, "a named worker is in the workshop at midday");
  assert.equal(at("E"), kettleId, "…and the one named into the inn is in the inn");
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
//
// THE GROUND LAYER JOINS THE SWEEP (0.12 slice 3b). It was left out because the
// ground vocabulary had not grown since the themes landed, and the omission is
// exactly the hole `bridge` would have fallen through: an unknown ground id does
// not render as nothing, it renders as GRASS (10-art's tile() falls back to the
// grass painter for an unknown id), so a bridge with no painter would have been
// a lawn laid across a pond and every assertion in this file would have passed.
{
  const drawable = new Set(loadedPF.art.painterNames());
  assert.ok(drawable.size > 10, `the art module reported its painters (${drawable.size})`);
  const missing = new Map();
  const look = (w, label) => {
    for (const zone of Object.values(w.zones)) {
      for (const layer of ["ground", "object", "overhead"]) {
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

// ── THE BRIDGE IS DRAWN IN BOTH TIERS (0.12 slice 3b) ──────────────────────
// The bridge ruling adds the first new GROUND id since the themes landed, and a
// ground id has two art homes: 10-art's runtime painters (Tier-0) and the
// build-time generator that bakes the shipped atlas (Tier-1). Missing Tier-1 art
// is a soft failure by design — every draw resolves Tier1 ?? Tier0 — but missing
// Tier-0 art is a bridge rendered as a lawn, so both are pinned.
{
  assert.ok(new Set(loadedPF.art.painterNames()).has("bridge"), "Tier-0 can paint a bridge");
  // The Tier-1 generator writes PNGs to disk and cannot be run inside this
  // process, so its painter table is read as SOURCE. That is enough to catch the
  // failure that matters: a tile added to one tier and forgotten in the other.
  const generator = readFileSync(join(here, "build", "build-art.mjs"), "utf8");
  assert.ok(/\n {2}bridge\(g, rnd\) \{/.test(generator), "…and so can the Tier-1 generator");
  // APPENDED, NEVER INSERTED — the generator's own rule, and the reason it is
  // worth asserting rather than trusting: that table's key order IS the atlas
  // index map, so a tile slotted in beside `water` where it reads nicely would
  // silently shift every index under it and repaint the whole shipped world.
  assert.ok(
    generator.indexOf("\n  bridge(g, rnd) {") > generator.indexOf("\n  bell(g) {"),
    "…with the new id on the END of the table, where the atlas index map can take it",
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
    // Three unknown keys, deliberately out of alphabetical order. `mmMiddle`
    // stood in as `player` until slice 3 made `player` one of OURS — the carry
    // is about keys this build does not know, and a key it now owns cannot test
    // that. The object shape is kept: a carried key is retained by value, and a
    // scalar would not prove it.
    zzTop: "kept verbatim",
    mmMiddle: { v: 1, pouch: { money: 7 } },
    aaFirst: [1, 2, 3],
    // …and the real `player`, at a version SEVEN builds ahead. It is a known
    // key, so it never reaches the carry; the block-level version gate refuses
    // it and quarantines it instead (asserted in the S5 slice-3 cases).
    player: { v: 7, pouch: { money: 99 } },
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
    ["aaFirst", "mmMiddle", "zzTop"],
    "exactly the unrecognized top-level keys are retained",
  );
  assert.equal(sim._envelopeExtra.mmMiddle.pouch.money, 7, "retained by value, not by name");
  assert.equal(sim._envelopeExtra.player, undefined, "and `player` is not among them — this build owns that key now");
  // The real shape of the "__proto__" hazard. A naive `extra[key] = saved[key]`
  // does NOT reach Object.prototype — it hits the __proto__ setter and repoints
  // the CARRY's prototype at the attacker's object, which then rides back out
  // through snapshot()'s own key loop. So the honest instrument is the carry's
  // prototype, not a probe of a fresh {} (that one cannot fail either way).
  assert.equal(
    Object.getPrototypeOf(sim._envelopeExtra),
    Object.prototype,
    "the carry is still an ordinary object — a __proto__ key never repointed it",
  );

  // snapshot() re-emits them FIRST, in a fixed order, with our own keys written
  // over the top — and it does it off a synthetic two-key core. Sorted is the
  // implementation; DETERMINISM is the property under test, because the dedupe,
  // the adopt compare and the rewind compare are all string equality.
  const snap = loadedPF.save.snapshot({ sim, chatId: "chat-forward" });
  assert.deepEqual(
    Object.keys(snap).slice(0, 3),
    ["aaFirst", "mmMiddle", "zzTop"],
    "the carried keys are emitted first and sorted, whatever order they arrived in",
  );
  assert.equal(snap.v, 1, "this build still stamps its own envelope version");
  assert.equal(snap.zone, otherZone, "and the known keys are ours, not the row's");
  assert.deepEqual(snap.mmMiddle, { v: 1, pouch: { money: 7 } }, "the newer build's block survives the flush");
  assert.equal(snap.player.v, 1, "while `player` is written at THIS build's block version");
  assert.equal(snap.player.pouch.money, 0, "booting the default block — the too-new one was quarantined, not read");

  // The whole point: it round-trips. Feed the flushed blob back in and nothing
  // has been shaved off.
  const again = loadedPF.save.simFromSaved(JSON.parse(JSON.stringify(snap)), meta, "chat-forward");
  assert.deepEqual(again._envelopeExtra, sim._envelopeExtra, "a second pass through the save path keeps them all");

  // A genuinely unreadable row still restores nothing but the world: the gate
  // is a floor, not an "anything goes".
  const junk = loadedPF.save.simFromSaved({ v: "1", seed: 1107, theme: "cozy-village", zone: otherZone }, meta, "c");
  assert.equal(junk.zoneId, w.startZone, "a non-numeric v is still refused");

  // The too-new `player` block above went somewhere: the quarantine bag, whose
  // write is a real PATCH. Drained here rather than left leaking into the next
  // case's bag (it is a module singleton, per-chat by reset()).
  loadedPF.save.reset();
}

// ── THE WIRE FORMAT IS PINNED TO A LITERAL (S5 slice 1) ────────────────────
// Every dedupe in the save path is string equality over JSON.stringify: the
// flush's _lastSerialized/_metaSerialized, adopt's comparison against the
// server row, and checkRewind's. So the exact bytes of a snapshot are an
// interface, and "the same function called twice agrees with itself" is not a
// test of it — it cannot fail, whatever the function does. This is the version
// that can: a fresh LEGACY sim, no carry, against a string built once by hand.
//
// When this fails, read the diff before touching it. A key reordered, renamed
// or dropped here means every save in the wild re-writes on first load and
// every open chat gets one spurious "The world rewound with the story."
//
// UPDATED ONCE, DELIBERATELY, BY S5 SLICE 3. The literal gained the `player`
// block and nothing else moved. This is the one sanctioned byte change, and the
// reason it is sanctioned is that the alternative is worse: a pre-S5 save gains
// the default block on its first write, which costs one re-write per open chat
// — and a pre-S5 BUILD reading that row would delete the block anyway, which is
// the documented §5 limitation, not a new one. Emitting it conditionally to
// avoid the churn is the slice-1 failure (see the registry case below).
//
// Note the all-zero `world` stamps: a sim built by the CONSTRUCTOR has never
// been rehydrated, and stamps are evaluated at rehydration only (plan §Q3a).
// simFromSaved fills them on the first restore, which costs one further write
// on a chat's second boot and never severs anything (an unstamped block has
// nothing to disagree with).
{
  const frozen =
    '{"v":1,"chatId":"chat-frozen","seed":9001,"theme":"cozy-village","zone":"village",' +
    '"x":344,"y":280,"facing":0,"clockMin":480,"day":1,"bindings":{},' +
    '"intro":{"world":false,"zones":{},"npcs":{}},' +
    '"player":{"v":1,"game":1,"world":{"seed":0,"briefHash":0,"mintStamp":0},"flushedDay":0,' +
    '"pouch":{"money":0,"items":[]},"skills":{"verbs":{},"equipped":{}},"quests_done_board":{},' +
    '"rel":{},"quests":{"done_pack":{},"active":[]},"ledger":{"lines":[]},"found":{"zones":[]},' +
    '"home":null}}';
  const legacy = new loadedPF.Sim(world.build(9001, "cozy-village"));
  assert.equal(
    JSON.stringify(loadedPF.save.snapshot({ sim: legacy, chatId: "chat-frozen" })),
    frozen,
    "the legacy envelope serializes to exactly the bytes every deployed save compares against",
  );
}

// ── THE STAGED WRAP-UP DAY SURVIVES THE ROUND TRIP (0.12 slice 4) ──────────
// The durable half of the two-field flush. `intro.ledgerOwed` is written by a
// completed sleep and read by the compose that tells those days — and between
// the two there is always at least one reload, or one `_rebuild`, which is the
// same code path. The intro parse is a CLOSED literal: a subkey it does not name
// is stripped on every restore, and the envelope carry cannot stand in for it
// because that carry holds unknown TOP-LEVEL keys only. Without the one line in
// simFromSaved that reads this field it is write-only state and the whole design
// is a marker that never outlives the session that staged it.
//
// DECLARED BYTE MOVEMENT, and it is why this is a case rather than an assertion:
// a save that HAS an intro block now round-trips carrying `"ledgerOwed":0`,
// which is one extra write per open chat on first load. A save with no intro at
// all — the frozen literal above, and every fresh sim — is untouched, because
// snapshot() falls back to the three-key literal for a sim that never composed.
{
  const sim = new loadedPF.Sim(world.build(6120, "cozy-village"));
  sim.intro = { world: true, zones: {}, npcs: {} };
  sim.intro.ledgerOwed = 4; // what a completed sleep stages
  const snap = JSON.parse(JSON.stringify(loadedPF.save.snapshot({ sim, chatId: "chat-owed" })));
  assert.equal(snap.intro.ledgerOwed, 4, "snapshot emits `intro` wholesale, so the staged day is already on the wire");
  const back = loadedPF.save.simFromSaved(snap, {}, "chat-owed");
  assert.equal(back.intro.ledgerOwed, 4, "…and the restore CARRIES it — the parse literal names it");
  assert.equal(back.intro.world, true, "with the one-shot flags it sits beside");

  // A SAVED NUMBER IS EVIDENCE, NEVER A VALUE. This one is about to be compared
  // against `sim.day` and used to lift a gate, so it comes back through the
  // resolver: anything that is not a whole day at or above zero owes nothing.
  for (const hostile of ["4", 3.5, -1, NaN, null, { day: 4 }]) {
    const row = { ...snap, intro: { ...snap.intro, ledgerOwed: hostile } };
    assert.equal(
      loadedPF.save.simFromSaved(row, {}, "chat-owed-hostile").intro.ledgerOwed,
      0,
      `a ledgerOwed of ${JSON.stringify(hostile)} owes nothing`,
    );
  }

  // THE MOVEMENT, PINNED IN BOTH DIRECTIONS. A pre-0.12 row carrying an intro
  // gains the field at zero (declared); a row carrying no intro at all gains
  // nothing, which is what keeps the frozen literal above frozen.
  const pre = { v: 1, seed: 6120, theme: "cozy-village", intro: { world: true, zones: {}, npcs: {} } };
  const lifted = loadedPF.save.simFromSaved(pre, {}, "chat-owed-pre");
  assert.equal(lifted.intro.ledgerOwed, 0, "a 0.11 row's intro reads back owing nothing");
  assert.equal(
    JSON.stringify(loadedPF.save.snapshot({ sim: lifted, chatId: "chat-owed-pre" }).intro),
    '{"world":true,"zones":{},"npcs":{},"ledgerOwed":0}',
    "…and re-serializes carrying it — one extra write per open chat, declared",
  );
  const bare = loadedPF.save.simFromSaved({ v: 1, seed: 6120, theme: "cozy-village" }, {}, "chat-owed-bare");
  assert.equal(
    JSON.stringify(loadedPF.save.snapshot({ sim: bare, chatId: "chat-owed-bare" }).intro),
    '{"world":false,"zones":{},"npcs":{}}',
    "while a row with no intro at all still serializes to the bytes the frozen literal pins",
  );
  loadedPF.save.reset();
}

// ── ENVELOPE_KEYS AND snapshot() CANNOT DRIFT APART (S5 slice 1) ───────────
// The registry is load-bearing in BOTH directions and neither one fails loudly:
//   • emitted but not listed → simFromSaved reads our own key back as "foreign"
//     and parks a stale copy of it on the carry;
//   • listed but not emitted → the read skips it and the write omits it, so a
//     newer build's field is deleted on the way through. That is the slice-1
//     bug, rebuilt one branch at a time — which is exactly how it will come
//     back when slice 3 adds `player` behind an `if`.
// 60-save asserts this at load (20-world's placer idiom); this drives it
// against a real sim as well, so the synthetic probe there cannot go stale.
{
  const keys = loadedPF.save._envelopeKeys;
  assert.ok(keys && typeof keys.has === "function", "the registry is reachable from outside the module");
  const sim = new loadedPF.Sim(world.build(515, "sci-fi-colony"));
  sim._envelopeExtra = { fromTheFuture: 1 };
  const snap = loadedPF.save.snapshot({ sim, chatId: "chat-registry" });
  const emitted = Object.keys(snap).filter((key) => key !== "fromTheFuture");
  for (const key of emitted) {
    assert.ok(keys.has(key), `snapshot emits "${key}" — ENVELOPE_KEYS has to list it or the read treats it as foreign`);
  }
  for (const key of keys) {
    assert.ok(
      emitted.includes(key),
      `ENVELOPE_KEYS lists "${key}" — snapshot has to emit it UNCONDITIONALLY or the write deletes a newer build's field`,
    );
  }
  assert.equal(emitted.length, keys.size, "and the two lists are the same size, so neither check is vacuous");
}

// ── A HOSTILE ROW BOOTS INSTEAD OF BRICKING (S5 slice 1) ───────────────────
// A save row is untrusted JSON and `world.zones` is a plain object, so the old
// `!!world.zones[saved.zone]` truthiness test read straight through
// Object.prototype. Two measured outcomes, both from one row:
//   • zone "constructor" resolves to a FUNCTION, is accepted as a real zone,
//     and the first read of z.w throws inside the mount;
//   • a binding naming "constructor" writes spatialLocationId onto the global
//     Object — a page-wide mutation from a chat's metadata.
{
  const before = "spatialLocationId" in Object;
  assert.equal(before, false, "the fixture starts from an unpolluted global");
  const w = world.build(1234, "cozy-village");
  const row = JSON.parse(
    `{"__proto__":{"polluted":true},"v":1,"seed":1234,"theme":"cozy-village","zone":"constructor",` +
      `"x":99,"y":99,"bindings":{"pf.evil":"constructor","pf.also":"toString","pf.real":"${w.startZone}"}}`,
  );
  const sim = loadedPF.save.simFromSaved(row, {}, "chat-hostile");
  assert.equal(sim.zoneId, w.startZone, "a prototype key is not a zone — the restore falls back to the start zone");
  assert.equal(sim.x, (sim.zone().spawn.x + 0.5) * loadedPF.TILE, "and lands the player on the spawn tile");
  assert.equal("spatialLocationId" in Object, false, "and nothing from a chat's metadata was written onto Object");
  assert.equal(sim.world.bindings["pf.evil"], undefined, "the hostile binding is dropped");
  assert.equal(sim.world.bindings["pf.also"], undefined, "and so is every other inherited name");
  assert.equal(sim.world.bindings["pf.real"], w.startZone, "while an honest binding in the same object still hangs");
  assert.equal(Object.getPrototypeOf(sim._envelopeExtra), Object.prototype, "the carry's prototype is untouched too");
  // The mount reads the zone immediately; this is the crash, reduced.
  assert.equal(typeof sim.zone().w, "number", "and the resolved zone is a real zone, not Object");
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
  loadedPF.api.putExperienceState = (chatId, state, keepalive, schemaVersion) => {
    calls.push({ kind: "put", chatId, state, keepalive, schemaVersion });
    return behavior.put(chatId, state, keepalive, schemaVersion);
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
      // The REAL helper, not the harness-wide no-op stub: this case is about
      // what PF.api itself does with a non-OK response.
      () => realPatchMetadata("chat-status", { pixelforge: {} }, false),
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
  // Driven the way the real ladder is driven: each rung FIRES and the flush it
  // starts is the next attempt. Calling flush() nine times in a row instead
  // would measure nine triggers against one clock, which is the thing the
  // shared timer exists to prevent (see _timerIsBackoff).
  await loadedPF.save.flush(core, false);
  for (let i = 0; i < 8; i++) {
    armed[armed.length - 1].fn();
    await loadedPF.save._flushChain;
  }
  assert.deepEqual(
    armed.map((a) => a.ms),
    [2500, 5000, 10_000, 30_000, 60_000, 60_000, 60_000, 60_000],
    "the backoff ladder walks and gives up after eight",
  );

  networkDown = false;
  loadedPF.save._timer = 0; // the last rung never armed; nothing is pending
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
    // The leading GET is slice 4's check-then-write pre-check: an ordinary
    // routes-mode flush looks at the row before overwriting it. Teardown never
    // does — it has no window to spend on one — which is the whole reason its
    // clean-gate DERIVES from the last check instead of taking its own.
    ["get", "put", "patch"],
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

// (i) A FOREIGN BLOCK TOO BIG TO SEND MUST NOT COST US OUR OWN SAVE.
// Slice 1 made the envelope carry a newer build's top-level keys. Slice 2 put a
// pre-flight in front of every write. Together they hand a newer build a switch
// that turns THIS build's persistence off: park an over-the-wall block on the
// row once and every later flush trips the pre-flight and degrades the session,
// with the player's own zone, clock and intro flags never reaching the server
// again. Our own state outranks a block we cannot read — and dropping the carry
// is what every build before slice 1 did, so it is a return to the old contract
// rather than new loss. The fixtures are sized past MAX_SNAPSHOT_CHARS, which
// now mirrors the route's own 262,144-char ceiling.
await withSavePath(async ({ calls, behavior, makeCore }) => {
  loadedPF.save.mode = "routes";
  const core = makeCore("chat-fat-carry", 808);
  core.sim._envelopeExtra = { fromTheFuture: "x".repeat(300_000) };
  await loadedPF.save.flush(core, false);
  const put = calls.find((c) => c.kind === "put");
  assert.ok(put, "the write still goes out");
  assert.equal(put.state.fromTheFuture, undefined, "without the block that does not fit");
  assert.equal(put.state.zone, core.sim.zoneId, "and carrying this world's own state, which is what is being played");
  assert.equal(loadedPF.save.degraded, false, "the session is NOT degraded");
  assert.deepEqual(core.toasts, [], "and the player is told nothing — nothing of theirs was lost");

  calls.length = 0;
  core.sim.day += 1;
  await loadedPF.save.flush(core, false);
  const next = calls.find((c) => c.kind === "put");
  assert.ok(next, "a later mutation writes too — persistence is not bricked");
  assert.equal(next.state.day, core.sim.day, "with the new value on it");

  // …AND THE PRE-FLIGHT ONLY REFUSES WHAT THE SERVER WOULD. It sat at 32,768 —
  // inherited caution, not a real wall — so a perfectly savable world anywhere
  // between 33 KB and the route's own 262,144-char cap was refused locally and
  // the session degraded permanently for it. Nothing is dropped in that band any
  // more: the whole snapshot, foreign carry included, goes up.
  loadedPF.save.reset();
  loadedPF.save.mode = "routes";
  calls.length = 0;
  const midband = makeCore("chat-midband", 809);
  midband.sim._envelopeExtra = { fromTheFuture: "m".repeat(100_000) };
  await loadedPF.save.flush(midband, false);
  const sent = calls.find((c) => c.kind === "put");
  assert.ok(sent, "a 100 KB snapshot writes");
  const sentChars = JSON.stringify(sent.state).length;
  assert.ok(sentChars > 32_768 && sentChars < 262_144, `and it really is in the band (${sentChars} chars)`);
  assert.equal(sent.state.fromTheFuture?.length, 100_000, "with the newer build's block intact — nothing was shed");
  assert.equal(loadedPF.save.degraded, false, "and the session is not degraded");
  assert.deepEqual(midband.toasts, [], "nor is the player told a world this size cannot be saved");

  // A world whose OWN save is over the wall is the case the degrade exists for,
  // and it still degrades. The two conditions must not be confused: one loses a
  // newer build's data, the other loses the player's.
  loadedPF.save.reset();
  loadedPF.save.mode = "routes";
  calls.length = 0;
  core.sim._envelopeExtra = {};
  core.sim.intro = { world: true, zones: { huge: "y".repeat(300_000) }, npcs: {} };
  await loadedPF.save.flush(core, false);
  assert.equal(calls.length, 0, "an oversized world of our own writes nothing");
  assert.equal(loadedPF.save.degraded, true, "and degrades");
  assert.equal(core.toasts.length, 1, "and says so once");
});

// (j) PAGEHIDE IS NOT ALWAYS A DEATH.
// flushTeardown updated no bookkeeping at all — the comment said a bfcache
// restore "is better off re-writing than trusting a write it never saw finish",
// but the caches were left holding the PRE-teardown bytes, which is not
// "re-write", it is "believe the server holds something it does not". The very
// next checkRewind then reads the row the teardown just wrote, finds it
// different from _serverSerialized, and rewinds the restored session onto our
// own write — toast and all. The handlers only run if the page survived.
await withSavePath(async ({ calls, behavior, tick, makeCore }) => {
  loadedPF.save.mode = "routes";
  const core = makeCore("chat-bfcache", 4242);
  await loadedPF.save.flush(core, false); // the session has a row, caches agree
  calls.length = 0;

  core.sim.day += 1; // the last thing the player did before the tab was hidden
  loadedPF.save.flushTeardown(core);
  await tick();
  const wrote = calls.find((c) => c.kind === "put");
  assert.ok(wrote, "the teardown wrote the route row");
  const after = JSON.stringify(wrote.state);
  assert.equal(loadedPF.save._serverSerialized, after, "and the client now knows what the server holds");
  assert.equal(loadedPF.save._lastSerialized, after, "the route dedupe is current");
  assert.equal(loadedPF.save._metaSerialized, after, "and so is the cache dedupe");

  // The consequence, which is the actual finding: the page came back.
  const simBefore = core.sim;
  calls.length = 0;
  behavior.get = async () => ({ available: true, status: 200, body: { exists: true, state: wrote.state } });
  await loadedPF.save.checkRewind(core);
  assert.equal(core.sim, simBefore, "a restored page is not rebuilt onto its own last write");
  assert.deepEqual(core.toasts, [], "and the player is not told the world rewound");

  // The keepalive quota is shared by the PAIR: 64 KiB per origin for every
  // in-flight body together, and routes mode sends two. Losing the cache PATCH
  // is repairable on the next load; losing both is the session.
  loadedPF.save.reset();
  loadedPF.save.mode = "routes";
  calls.length = 0;
  const fat = makeCore("chat-fat-exit", 4243);
  fat.sim._envelopeExtra = { fromTheFuture: "z".repeat(30_000) };
  const fatBytes = new TextEncoder().encode(JSON.stringify(loadedPF.save.snapshot(fat))).length;
  assert.ok(fatBytes < 262_144, "the fixture is under the single-request pre-flight (the server's own cap)");
  assert.ok(2 * fatBytes > 57_000, "and over the keepalive pair quota — which is the whole point of the fixture");
  loadedPF.save.flushTeardown(fat);
  assert.deepEqual(
    calls.map((c) => c.kind),
    ["put"],
    "over the keepalive pair quota the authority goes alone instead of both being dropped",
  );
});

// (k) THE CAPTURED CHAT-SWITCH WRITE IS NOT INVISIBLE.
// Two seams, one cause: a write taken at the old chat's generation is stale for
// every per-chat cache on this object and STILL happened on the wire.
await withSavePath(async ({ calls, behavior, tick, makeCore }) => {
  // (k1) _writeSeq is process-global, so the bump belongs OUTSIDE the fence.
  // Driven through _flushNow directly on purpose: the flush chain is what keeps
  // these two apart today, and the sequence has to be right independently of it
  // — flushTeardown bumps it from off the chain entirely.
  loadedPF.save.mode = "routes";
  const core = makeCore("chat-seq", 21);
  const capture = loadedPF.save.captureFlush(core);
  assert.ok(capture, "there is a pending write to capture");
  loadedPF.save.reset(); // the chat switch: the capture is stale from here on
  loadedPF.save.mode = "routes";
  loadedPF.save._serverSerialized = '{"anchor":1}';

  let releaseGet;
  behavior.get = () => new Promise((resolve) => (releaseGet = resolve));
  const rewind = loadedPF.save.checkRewind(core);
  await tick();
  assert.ok(releaseGet, "the rewind check has a GET in flight");

  let releasePut;
  behavior.put = () => new Promise((resolve) => (releasePut = resolve));
  const stale = loadedPF.save._flushNow(core, false, capture);
  // The PUT is one microtask further out than it used to be: slice 4's flush
  // pre-check is awaited ahead of it even when — as here, for a stale
  // chat-switch capture — it declines to issue a GET at all.
  await tick();
  assert.ok(releasePut, "the stale capture's PUT is in flight, and no probe was issued for it");
  assert.equal(
    calls.filter((c) => c.kind === "get").length,
    1,
    "the only GET in flight is the rewind check's — a capture from a chat we left does not pre-check",
  );
  releasePut();
  await stale;

  releaseGet({ available: true, status: 200, body: { exists: true, state: { v: 1, moved: true } } });
  await rewind;
  assert.deepEqual(core.toasts, [], "a GET our own PUT overtook is discarded, not adopted as an external move");
  assert.equal(loadedPF.save._serverSerialized, '{"anchor":1}', "and it never becomes the anchor");

  // (k2) adopt() rides the chain, like checkRewind. Off it, the new chat's
  // probe can latch a row while the leaving chat's captured write is still in
  // the air — and on a return visit that row is the one about to be replaced.
  loadedPF.save.reset();
  loadedPF.save.mode = "routes";
  calls.length = 0;
  behavior.get = async () => ({ available: false, status: 404 });
  const core2 = makeCore("chat-adopt", 44);
  const capture2 = loadedPF.save.captureFlush(core2);
  loadedPF.save.reset();
  behavior.put = () => new Promise((resolve) => (releasePut = resolve));
  void loadedPF.save.flush(core2, false, capture2);
  const adopting = loadedPF.save.adopt(core2);
  await tick();
  assert.deepEqual(
    calls.map((c) => c.kind),
    ["put"],
    "the probe is not issued while the captured write is in flight",
  );
  releasePut();
  await adopting;
  assert.deepEqual(
    calls.map((c) => c.kind),
    ["put", "patch", "get"],
    "it runs only once that write — route row and write-through cache — has landed",
  );
});

// (l) A PROBE REJECTION FROM THE CHAT YOU LEFT.
// adopt()'s success path was fenced on the captured generation and chat id; its
// CATCH was not. So a probe that finally rejects after a chat switch sets
// mode = "metadata" and pins — and because adopt() short-circuits on
// mode !== null, the chat the player is actually on never gets a probe of its
// own. One stale rejection costs the new chat timeline rewind for the session.
await withSavePath(async ({ behavior, tick, makeCore }) => {
  const core = makeCore("chat-a", 55);
  let rejectProbe;
  behavior.get = () => new Promise((resolve, reject) => (rejectProbe = reject));
  void loadedPF.save.adopt(core);
  await tick();
  assert.ok(rejectProbe, "the first chat's probe is in flight");

  loadedPF.save.reset();
  core.chatId = "chat-b";
  core.sim = new loadedPF.Sim(world.build(56, "cozy-village"));
  behavior.get = async () => ({ available: true, status: 200, body: { exists: false } });
  const adoptingB = loadedPF.save.adopt(core);

  rejectProbe(new TypeError("NetworkError when attempting to fetch resource"));
  await adoptingB;
  await tick();
  assert.equal(loadedPF.save.mode, "routes", "the chat we are ON keeps the mode its own probe earned");
  assert.equal(loadedPF.save._probePinned, false, "and a rejection addressed to the chat we left pins nothing");
});

// (m) A HALF-LANDED FLUSH IS NOT A LANDED FLUSH.
// In routes mode the write-through cache PATCH had its own catch: a console
// warning and a bare markDirty. Two consequences, both silent. _onWriteLanded
// still ran, so the failure counter reset on every round — and markDirty
// re-armed a flat 2.5s. A broken metadata route therefore got retried every 2.5
// seconds for the whole session instead of walking the ladder that exists for
// exactly this.
await withSavePath(async ({ armed, behavior, makeCore }) => {
  loadedPF.save.mode = "routes";
  const core = makeCore("chat-cache", 66);
  behavior.patch = async () => {
    throw new TypeError("NetworkError when attempting to fetch resource");
  };
  await loadedPF.save.flush(core, false);
  assert.equal(loadedPF.save._flushFailures, 1, "the route row landed and the cache did not — that is a failure");
  assert.deepEqual(
    armed.map((a) => a.ms),
    [2500],
    "and it takes the ladder's bottom rung",
  );
  for (let i = 0; i < 3; i++) {
    armed[armed.length - 1].fn();
    await loadedPF.save._flushChain;
  }
  assert.deepEqual(
    armed.map((a) => a.ms),
    [2500, 5000, 10_000, 30_000],
    "and the ladder WALKS — it is not reset to 2.5s by the route row landing every round",
  );

  behavior.patch = async () => {};
  core.sim.day += 1;
  await loadedPF.save.flush(core, false);
  assert.equal(loadedPF.save._flushFailures, 0, "a flush where BOTH writes land still clears the counter");

  // A 409 from the metadata route is the metadata route talking. Dropping the
  // experience-state authority on it would be a non sequitur.
  loadedPF.save.reset();
  loadedPF.save.mode = "routes";
  armed.length = 0;
  behavior.patch = async () => {
    throw Object.assign(new Error("PATCH metadata → 409"), { status: 409 });
  };
  core.sim.day += 1;
  await loadedPF.save.flush(core, false);
  assert.equal(loadedPF.save.mode, "routes", "a cache 409 does not fall back to metadata mode");
  assert.equal(loadedPF.save._probePinned, false, "and does not pin for re-probe");
  assert.deepEqual(
    armed.map((a) => a.ms),
    [2500],
    "it takes the ladder like any other cache failure",
  );
});

// (n) A BACKOFF RUNG IS NOT CANCELLABLE.
// The ladder shares markDirty's timer so a busy player cannot reset it — but
// the sharing only worked in one direction. _flushNow cleared the timer at the
// top whatever it was for, so any flush from another trigger deleted the
// pending rung; and a TEARDOWN flush, which never re-arms, deleted it outright.
// The ladder has to measure elapsed time, not requested time.
await withSavePath(async ({ armed, behavior, makeCore }) => {
  loadedPF.save.mode = "metadata";
  const core = makeCore("chat-ladder", 77);
  behavior.patch = async () => {
    throw new TypeError("NetworkError when attempting to fetch resource");
  };
  await loadedPF.save.flush(core, false);
  for (let i = 0; i < 4; i++) {
    armed[armed.length - 1].fn();
    await loadedPF.save._flushChain;
  }
  assert.deepEqual(
    armed.map((a) => a.ms),
    [2500, 5000, 10_000, 30_000, 60_000],
    "the session has climbed to the 60s rung",
  );
  const pending = loadedPF.save._timer;
  assert.notEqual(pending, 0, "with that rung actually armed");

  loadedPF.save.markDirty(core);
  loadedPF.save.markDirty(core);
  assert.equal(loadedPF.save._timer, pending, "a busy player cannot reset a live rung to 2.5s");
  assert.equal(armed.length, 5, "and arms nothing of their own");

  await loadedPF.save.flush(core, true);
  assert.equal(loadedPF.save._timer, pending, "and a teardown flush — which never re-arms — must not delete it");
  assert.equal(loadedPF.save._timerIsBackoff, true, "the timer is still a rung, not a debounce");
});

// (o) A PROBE FAILURE THE ROUTE MEANT IS NOT A BLIP.
// The pin exists for a transport failure or a server having a bad minute. A 401
// or a 403 will say the same thing in sixty seconds, and in six hundred: pinning
// on it buys a background request every minute for the life of the tab and
// changes nothing. And even a genuine blip gets a bounded number of asks, on the
// same discipline the write ladder already has.
{
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 503 });
  try {
    await assert.rejects(
      () => loadedPF.api.getExperienceState("chat-probe"),
      (err) => err.status === 503 && err.message === "GET experience-state → 503",
      "a rejected probe carries its status, and keeps the message it always had",
    );
  } finally {
    globalThis.fetch = realFetch;
  }
}
await withSavePath(async ({ armed, behavior, tick, makeCore }) => {
  const httpError = (status) => Object.assign(new Error(`GET experience-state → ${status}`), { status });
  for (const status of [401, 403]) {
    loadedPF.save.reset();
    behavior.get = async () => {
      throw httpError(status);
    };
    await loadedPF.save.adopt(makeCore(`chat-${status}`, 88));
    assert.equal(loadedPF.save.mode, "metadata", `a ${status} still degrades to metadata mode`);
    assert.equal(loadedPF.save._probePinned, false, `but a ${status} is an answer, not a blip — it never pins`);
  }

  loadedPF.save.reset();
  armed.length = 0;
  behavior.get = async () => {
    throw httpError(503);
  };
  await loadedPF.save.adopt(makeCore("chat-503", 89));
  assert.equal(
    loadedPF.save._probePinned,
    true,
    "a 5xx is the server having a bad minute, and that is worth re-asking",
  );
  const interval = armed.find((a) => a.interval);
  assert.ok(interval, "on an interval");
  assert.equal(interval.ms, 60_000, "at ~60s");

  let fired = 0;
  while (loadedPF.save._reprobeTimer && fired < 20) {
    interval.fn();
    await tick();
    fired++;
  }
  assert.equal(fired, 8, "which gives up after eight failed rungs rather than asking for the life of the tab");
  assert.equal(loadedPF.save._reprobeTimer, 0, "the interval is cleared");
  assert.equal(
    loadedPF.save._probePinned,
    true,
    "the pin itself stays — a metadata write that lands later still earns its one-shot attempt",
  );
});

// (p) THE PROMOTION'S FIRST WRITE IS NOT CANCELLABLE EITHER.
// _reprobe promotes a pinned session with FIRST-WRITE semantics, and the whole
// mechanism was `_lastSerialized = null`. A flush already parked inside its
// PATCH when the promotion happens lands afterwards and assigns that cache
// straight back — so the next flush dedupes to nothing and the promotion's
// first route write never happens. The session sits in "routes" mode with no
// row of its own until something else changes the world.
await withSavePath(async ({ calls, behavior, tick, makeCore }) => {
  const core = makeCore("chat-promote", 91);
  behavior.get = async () => {
    throw new TypeError("NetworkError when attempting to fetch resource");
  };
  await loadedPF.save.adopt(core);
  assert.equal(loadedPF.save._probePinned, true, "the session is pinned to metadata mode");

  let releasePatch;
  behavior.patch = () => new Promise((resolve) => (releasePatch = resolve));
  core.sim.day += 1;
  const parked = loadedPF.save.flush(core, false);
  await tick();
  assert.ok(releasePatch, "an ordinary metadata flush is parked inside its PATCH");

  behavior.get = async () => ({ available: true, status: 200, body: { exists: false } });
  await loadedPF.save._reprobe(core);
  assert.equal(loadedPF.save.mode, "routes", "the re-probe promotes the session");
  assert.equal(loadedPF.save._lastSerialized, null, "forcing the first write up");

  releasePatch();
  await parked;
  assert.notEqual(loadedPF.save._lastSerialized, null, "and the late flush does put the dedupe cache back");

  calls.length = 0;
  behavior.patch = async () => {};
  await loadedPF.save.flush(core, false);
  assert.ok(
    calls.some((c) => c.kind === "put"),
    "the promotion's first route write happens anyway — a flush that landed after it cannot un-force it",
  );
  assert.equal(loadedPF.save._forceWrite, false, "and the force is spent by the write that consumed it");
});

// ═══ THE PLAYER STATE BLOCK (S5 slice 3) ═══════════════════════════════════

// (q) THE BLOCK'S BYTES ARE AN INTERFACE, AND THEY DO NOT DEPEND ON PLAY ORDER.
// Every dedupe in the save path is string equality over JSON.stringify, and the
// player block is now most of the snapshot. Two players who did the same things
// in a different order hold the same state — so if the serializer leaked
// insertion order, one of them would re-write their row on every load and take a
// spurious "The world rewound with the story." with it.
await withSavePath(async ({ makeCore }) => {
  const P = loadedPF.player;
  const play = (core, order) => {
    for (const step of order) step(core);
    return JSON.stringify(P.serialize(core.sim.player));
  };
  const steps = [
    (c) => P.grant(c, { t: "rod", k: "fine" }, 2),
    (c) => P.grant(c, "apple", 3),
    (c) => P.grant(c, { t: "bait", k: "decent" }, 1),
    (c) => P.award(c, { money: 40, xp: 8, verb: "fishing" }),
    (c) => P.equip(c, "fishing", "tool", { t: "rod", k: "fine" }),
    (c) => P.bump(c, "village", "Alder Vance", { d: 2, s: "Sided with him over the survey." }),
    (c) => P.bump(c, "village", "Maud Thatch", { d: 1, h: true }),
    (c) => P.discover(c, { p: "z4", e: 0, d: 3, day: 12 }),
    (c) => P.discover(c, { p: "z2", e: 1, d: 0, day: 9 }),
    (c) => P.setHome(c, "z3"),
  ];
  const forwards = play(makeCore("chat-bytes-a", 4242), steps);
  const backwards = play(makeCore("chat-bytes-b", 4242), [...steps].reverse());
  assert.equal(forwards, backwards, "the same state serializes to the same bytes whatever order it was played in");

  // …and it survives the wire. parse() normalizes through the same serializer,
  // which is what makes "shape-validated" and "byte-stable" one property.
  const again = JSON.stringify(P.serialize(P.parse(JSON.parse(forwards)).player));
  assert.equal(again, forwards, "and a round trip through parse() changes not one byte");

  // The whole envelope round-trips too, which is the thing the flush compares.
  // The FIRST pass through simFromSaved is allowed to move: a block built by the
  // Sim constructor has never been rehydrated, and stamps are evaluated at
  // rehydration only (plan §Q3a), so that pass fills them in. Every pass after
  // it is byte-identical, which is what keeps a reopened chat from re-writing
  // its row and toasting a rewind that did not happen.
  const core = makeCore("chat-bytes-c", 4242);
  for (const step of steps) step(core);
  const first = loadedPF.save.simFromSaved(
    JSON.parse(JSON.stringify(loadedPF.save.snapshot(core))),
    {},
    "chat-bytes-c",
  );
  const settled = JSON.stringify(loadedPF.save.snapshot({ sim: first, chatId: "chat-bytes-c" }));
  assert.ok(settled.includes('"seed":4242'), "the first rehydration is what stamps the block for its world");
  const second = loadedPF.save.simFromSaved(JSON.parse(settled), {}, "chat-bytes-c");
  assert.equal(
    JSON.stringify(loadedPF.save.snapshot({ sim: second, chatId: "chat-bytes-c" })),
    settled,
    "and from there the envelope round-trips byte-for-byte through simFromSaved",
  );
});

// (r) `player` IS EMITTED UNCONDITIONALLY, LIKE EVERY OTHER LISTED KEY.
// The registry case above proves the two lists agree; this proves the emission
// has no branch on it. A sim with no block at all — which is what every
// synthetic core in this package is one refactor away from being — still emits
// the default, because the alternative is the slice-1 bug with a fresh coat.
{
  const sim = new loadedPF.Sim(world.build(11, "cozy-village"));
  assert.ok(sim.player, "the Sim constructor default-inits the block");
  delete sim.player;
  const snap = loadedPF.save.snapshot({ sim, chatId: "chat-noplayer" });
  assert.ok(snap.player, "and snapshot emits one even when the sim has none");
  assert.equal(snap.player.v, loadedPF.player.currentV(), "at this build's block version");
  assert.ok(loadedPF.save._envelopeKeys.has("player"), "and the registry lists it");
}

// (s) A MIGRATION THAT THROWS QUARANTINES ITS INPUT AND BOOTS A WRITABLE BLOCK.
// The failure mode this exists for is a shipped migration with a bug in it: the
// step runs against every save in the wild exactly once, and the ones it throws
// on are gone unless something catches them. What is quarantined is the step's
// INPUT, not its half-migrated output — the input is what a fixed step will be
// run against.
await withSavePath(async ({ calls, tick, makeCore }) => {
  const P = loadedPF.player;
  const before = P.MIGRATIONS.length;
  P.MIGRATIONS.push(() => {
    throw new TypeError("the v1 to v2 step is broken");
  });
  try {
    const core = makeCore("chat-mig", 505);
    const row = { v: 1, seed: 505, theme: "cozy-village", player: { v: 1, pouch: { money: 77, items: [] } } };
    core.sim = loadedPF.save.restore({ pixelforge: row }, "chat-mig");
    assert.equal(core.sim.player.pouch.money, 0, "the throwing step boots defaults, not a half-migrated block");
    assert.equal(core.sim.player.v, P.currentV(), "at this build's version");
    const slot = loadedPF.quarantine.peek("migration");
    assert.ok(slot, "and the block is quarantined");
    assert.equal(slot.reason, "throw", "in the migration slot, marked as a throw");
    assert.equal(slot.fromV, 1, "with the version it was written at");
    assert.equal(slot.block.pouch.money, 77, "and the step's INPUT, verbatim");
    assert.ok(/broken/.test(slot.message), "carrying what the step said on the way out");
    await tick();
    assert.ok(
      calls.some((c) => c.kind === "patch" && c.patch.pixelforgeQuarantine),
      "written immediately to its own metadata key",
    );
    // SECTIONS WRITABLE. A defaults boot that could not be mutated would be a
    // read-only session nobody told the player about.
    assert.equal(P.grant(core, "apple", 1), 1, "and the defaults boot is a fully writable block");
    assert.equal(core.sim.dirty, true, "which dirties the sim like any other mutation");
  } finally {
    P.MIGRATIONS.length = before;
  }
});

// (t) A TOO-NEW BLOCK IS RE-ADOPTED EXACTLY ONCE, AND BOOT C CHANGES NOTHING.
// Three boots. A: this build cannot read a v7 block, so it is quarantined
// verbatim and never overwritten. B: a later build can, so it takes it back —
// CONSUMING the slot and parking the block it displaces in setAside, which no
// machine ever restores. C: there is nothing left to adopt, and the absence of a
// slot is what makes that true rather than a flag somebody has to remember.
await withSavePath(async ({ calls, tick, makeCore }) => {
  const P = loadedPF.player;
  const before = P.MIGRATIONS.length;
  try {
    // ── BOOT A ────────────────────────────────────────────────────────────────
    const core = makeCore("chat-toonew", 321);
    const tooNew = { v: 7, game: 1, pouch: { money: 99, items: [] }, somethingNew: true };
    const row = { v: 1, seed: 321, theme: "cozy-village", player: tooNew };
    core.sim = loadedPF.save.restore({ pixelforge: row }, "chat-toonew");
    assert.equal(core.sim.player.pouch.money, 0, "a too-new block is never parsed — defaults boot");
    const parked = loadedPF.quarantine.peek("version");
    assert.ok(parked, "it is quarantined instead");
    assert.equal(parked.adoptable, true, "marked adoptable AT CREATION — that mark is what a later build looks for");
    assert.equal(parked.fromV, 7, "with the version that wrote it");
    assert.deepEqual(parked.block, tooNew, "verbatim, including the field this build has no idea about");
    assert.equal(loadedPF.quarantine.peek("setAside"), null, "and nothing was displaced yet");
    await tick();
    const wrote = calls.filter((c) => c.kind === "patch" && c.patch.pixelforgeQuarantine);
    assert.equal(wrote.length, 1, "written immediately");
    assert.equal(wrote[0].patch.pixelforge, undefined, "to its OWN key — never the snapshot, never the route row");
    // …and then this build plays on and flushes, which OVERWRITES the row with
    // its own defaults block. That is the documented §5 limitation and it is
    // exactly why the quarantine exists: after this write, the bag is the only
    // copy of the v7 block left anywhere.
    const metaAfterA = {
      pixelforge: loadedPF.save.snapshot({ sim: core.sim, chatId: "chat-toonew" }),
      pixelforgeQuarantine: JSON.parse(JSON.stringify(loadedPF.quarantine._bag)),
    };
    assert.equal(
      metaAfterA.pixelforge.player.pouch.money,
      0,
      "the row now holds this build's defaults, not the v7 block",
    );

    // ── BOOT B: a later build, six identity steps ahead ───────────────────────
    for (let i = 0; i < 6; i++) P.MIGRATIONS.push((block) => block);
    assert.equal(P.currentV(), 7, "the later build reads v7 natively");
    loadedPF.save.reset();
    calls.length = 0;
    const simB = loadedPF.save.restore(metaAfterA, "chat-toonew");
    assert.equal(simB.player.pouch.money, 99, "the quarantined block is RE-ADOPTED");
    assert.equal(loadedPF.quarantine.peek("version"), null, "and the adoption CONSUMES the slot");
    const aside = loadedPF.quarantine.peek("setAside");
    assert.ok(aside, "the live block it displaced is parked instead of dropped");
    assert.equal(aside.block.pouch.money, 0, "which is the defaults block this boot started from");
    await tick();
    const metaAfterB = {
      pixelforge: loadedPF.save.snapshot({ sim: simB, chatId: "chat-toonew" }),
      pixelforgeQuarantine: JSON.parse(JSON.stringify(loadedPF.quarantine._bag)),
    };
    assert.equal(metaAfterB.pixelforgeQuarantine.version, undefined, "and the stored bag no longer holds it");

    // ── BOOT C ────────────────────────────────────────────────────────────────
    loadedPF.save.reset();
    calls.length = 0;
    const simC = loadedPF.save.restore(metaAfterB, "chat-toonew");
    assert.equal(simC.player.pouch.money, 99, "boot C keeps the adopted block");
    assert.deepEqual(
      loadedPF.quarantine.slots(),
      ["setAside"],
      "and changes nothing: no second adoption, no second displacement",
    );
    assert.equal(
      JSON.stringify(loadedPF.save.snapshot({ sim: simC, chatId: "chat-toonew" })),
      JSON.stringify(metaAfterB.pixelforge),
      "the world it boots is byte-identical to boot B's",
    );
  } finally {
    P.MIGRATIONS.length = before;
  }
});

// (u) THE BAG'S SLOTS ARE INDEPENDENT, AND ITS OVERFLOW HAS AN ORDER.
// First-loss-wins is per SLOT: the first thing a slot lost is the one furthest
// from being recoverable any other way, and a full slot must not silence a loss
// of a different kind. Overflow drops in a fixed order, setAside first.
await withSavePath(async ({ tick }) => {
  const Q = loadedPF.quarantine;
  Q.reset();
  assert.equal(Q.put("chat-slots", "migration", { reason: "throw", block: { first: true } }), true);
  assert.equal(
    Q.put("chat-slots", "migration", { reason: "throw", block: { second: true } }),
    false,
    "a second loss of the same kind does not displace the first",
  );
  assert.equal(Q.peek("migration").block.first, true, "the first one is what is held");
  assert.equal(
    Q.put("chat-slots", "version", { adoptable: true, fromV: 9, block: {} }),
    true,
    "and a full migration slot does not silence a version loss — the slots are independent",
  );
  assert.deepEqual(Q.slots(), ["migration", "version"]);
  await tick();

  // OVERFLOW. Sized OFF THE CEILING rather than at a literal, so the tripwire's
  // value can move without re-tuning the case: four entries at 28% of the bag
  // overflow it by about one entry, so exactly one goes — and which one is the
  // whole test.
  Q.reset();
  const fat = (tag) => ({ reason: tag, block: { blob: "x".repeat(Math.floor(Q.MAX_CHARS * 0.28)) } });
  for (const slot of ["version", "migration", "stamp", "setAside"]) Q.put("chat-fat", slot, fat(slot));
  assert.equal(Q.peek("setAside"), null, "an overflowing bag drops the setAside entry first");
  assert.deepEqual(
    Q.slots(),
    ["migration", "stamp", "version"],
    "and keeps the three that a machine can still restore",
  );
  assert.ok(JSON.stringify(Q._bag).length <= Q.MAX_CHARS, "under its own ceiling, which is not the snapshot's");
  await tick(); // let this group's queued bag writes land before the next reset

  // Push harder and the order continues: stamp is next, then migration.
  Q.reset();
  const fatter = (tag) => ({ reason: tag, block: { blob: "y".repeat(Math.floor(Q.MAX_CHARS * 0.55)) } });
  for (const slot of ["version", "migration", "stamp", "setAside"]) Q.put("chat-fatter", slot, fatter(slot));
  assert.deepEqual(Q.slots(), ["version"], "least-recoverable first, all the way down to the adoptable block");
  await tick();
  Q.reset();
});

// (v) A DROPPED QUARANTINE KEY IS RE-ASSERTED ON THE NEXT PROPS DELIVERY.
// ~40 engine call sites still use the unqueued whole-blob updateMetadata, any of
// which can erase a package key between turns. The save key already had a
// self-heal; the quarantine key needs its OWN, because the two are written by
// different paths and neither one's survival says anything about the other's.
await withSavePath(async ({ calls, tick, makeCore }) => {
  const Q = loadedPF.quarantine;
  const core = makeCore("chat-dropped", 606);
  Q.reset();
  Q.put(core.chatId, "stamp", { reason: "brief", stamps: { seed: 1, briefHash: 2, mintStamp: 3 }, fields: {} });
  await tick();
  calls.length = 0;

  // A props delivery whose metadata has lost the key.
  loadedPF.save.ensurePresent(core, { pixelforge: { v: 1 } });
  await tick();
  const repair = calls.filter((c) => c.kind === "patch" && c.patch.pixelforgeQuarantine);
  assert.equal(repair.length, 1, "the bag is re-asserted from memory");
  assert.equal(repair[0].patch.pixelforgeQuarantine.stamp.reason, "brief", "with what it was holding");

  // …and a delivery that still HAS the key does not re-write it.
  calls.length = 0;
  loadedPF.save.ensurePresent(core, { pixelforge: { v: 1 }, pixelforgeQuarantine: { stamp: {} } });
  await tick();
  assert.equal(calls.length, 0, "an intact key costs nothing");
  Q.reset();
});

// (w) SEVERANCE AND THE COUPLED GATE.
// `flushedDay` is only interpretable against the lines it gates, so it moves
// WITH them and only when they actually move. Two cases, and they are opposites:
// nothing severed must leave the gate untouched, and a severance that spans an
// unflushed day must pull the gate back far enough that nothing comes home below
// it — a restored line at or under the gate is one the flush will never tell.
{
  const P = loadedPF.player;
  const briefA = brief.defaults("cozy-village", 900);
  const briefB = brief.defaults("sci-fi-colony", 900);
  const wA = world.build(900, "cozy-village", briefA);
  const wB = world.build(900, "sci-fi-colony", briefB);

  // ── An EMPTY line buffer leaves the gate exactly where it was ─────────────
  {
    const p = P.defaultPlayer();
    p.world = P.stampsFor(wA, briefA);
    p.flushedDay = 8;
    p.rel = { z1: { "Alder Vance": { d: 2, t: 3 } } };
    const out = P.applyStamps(p, wB, briefB, false);
    assert.ok(out.severed, "a changed brief severs");
    assert.equal(p.flushedDay, 8, "a stamp severance with an empty line buffer leaves the gate unchanged");
    assert.deepEqual(p.rel, {}, "while the world-bound rows do go");
  }

  // ── A severance ACROSS AN UNFLUSHED DAY, and the way home ─────────────────
  {
    const p = P.defaultPlayer();
    p.world = P.stampsFor(wA, briefA);
    // The gate has run ahead of the buffer — a flush that was accepted and then
    // lost (§5, accepted). Days 6 and 7 are still sitting there unflushed.
    p.flushedDay = 8;
    p.ledger.lines = [
      [6, "Walked the north field."],
      [7, "Sat with Alder while he lied about the survey."],
    ];
    p.rel = { z1: { "Alder Vance": { d: 2, t: 3 } } };
    const out = P.applyStamps(p, wB, briefB, false);
    assert.ok(out.severed, "the changed brief severs");
    assert.equal(p.flushedDay, 5, "the gate is clamped to minSeveredLineDay - 1, not left at 8");
    assert.deepEqual(p.ledger.lines, [], "and the buffer went with it");
    assert.equal(out.severed.entry.fields.flushedDayWas, 8, "the entry records where the gate had got to");

    // The world comes back. Restoration DISCARDS whatever was written during the
    // window and re-applies the guard.
    p.ledger.lines = [[9, "Something that happened in the other world."]];
    p.flushedDay = 12;
    const restored = P.restoreStamped(p, out.severed.entry, wA, briefA);
    assert.ok(restored, "matching stamps restore");
    assert.equal(restored.ledger.lines.length, 2, "the severed lines are back");
    assert.ok(
      !restored.ledger.lines.some(([day]) => day === 9),
      "and the line written during the window is discarded — it belonged to the other world",
    );
    const lowest = Math.min(...restored.ledger.lines.map(([day]) => day));
    assert.ok(
      lowest > restored.flushedDay,
      `a stamp severance across an unflushed day leaves no line below the gate after restoration (${lowest} > ${restored.flushedDay})`,
    );
    assert.deepEqual(restored.rel.z1["Alder Vance"], { d: 2, t: 3 }, "and the relationship row came home too");

    // The guard is RE-APPLIED on the way in, not trusted from the entry. An
    // entry that carries no gate of its own — an older bag, a mint-reason
    // severance, anything hand-edited — still comes home with every line above
    // the gate, because the invariant belongs to the restore and not to the
    // thing being restored.
    const gateless = { ...out.severed.entry, fields: { ...out.severed.entry.fields, flushedDay: undefined } };
    const late = P.defaultPlayer();
    late.flushedDay = 12;
    const homed = P.restoreStamped(late, gateless, wA, briefA);
    assert.ok(homed, "a gateless entry still restores");
    assert.ok(
      Math.min(...homed.ledger.lines.map(([day]) => day)) > homed.flushedDay,
      "and the guard pulls the gate back under the lines rather than leaving them untellable",
    );

    // A stamp entry from a DIFFERENT world does not restore.
    const wrong = P.restoreStamped(P.defaultPlayer(), out.severed.entry, wB, briefB);
    assert.equal(wrong, false, "a stamp slot only restores into the world it was severed from");
  }

  // ── MINT-ONLY: the brief is the same, so the named cast is the same people ─
  {
    const p = P.defaultPlayer();
    p.world = P.stampsFor(wA, briefA);
    const namedPerson = briefA.cast[0].name;
    const mintedPerson = wA.minted[0];
    assert.ok(mintedPerson && mintedPerson !== namedPerson, "the fixture has both a named and a minted resident");
    p.rel = { z1: { [namedPerson]: { d: 3, t: 9 }, [mintedPerson]: { d: 1, t: 2 } } };
    p.quests.active = [
      { id: "q-named", g: `z1|${namedPerson}`, verb: "gather", target: "herb", n: 1, have: 0, r: {}, day: 3 },
      { id: "q-minted", g: `z1|${mintedPerson}`, verb: "gather", target: "herb", n: 1, have: 0, r: {}, day: 3 },
    ];
    p.ledger.lines = [[4, "A line that is NOT severed by a mint change."]];
    p.flushedDay = 2;
    // Same brief, a mint that moved: MINT_V bumped, or the name book changed.
    const remint = { ...wA, mintStamp: (wA.mintStamp ^ 0x5eed) >>> 0 };
    const out = P.applyStamps(p, remint, briefA, false);
    assert.ok(out.severed, "a moved mint severs");
    assert.equal(out.severed.entry.reason, "mint", "as a mint severance, not a brief one");
    assert.ok(p.rel.z1 && p.rel.z1[namedPerson], "the person the BRIEF named keeps their row");
    assert.equal(p.rel.z1[mintedPerson], undefined, "the minted one does not");
    assert.deepEqual(
      p.quests.active.map((q) => q.id),
      ["q-named"],
      "and only the minted GIVER's quest goes",
    );
    assert.equal(p.ledger.lines.length, 1, "the ledger is untouched by a mint change");
    assert.equal(p.flushedDay, 2, "and so is the gate — no lines were severed");
  }
}

// (x) AN `s` LINE PAST THE CAP EVICTS THE OLDEST LINE, NEVER THE ROW.
// Two caps bite on `rel` and they bite differently. Losing the row to make room
// for a sentence would trade a relationship for a quote.
await withSavePath(async ({ makeCore }) => {
  const P = loadedPF.player;
  const core = makeCore("chat-lines", 707);
  for (let i = 0; i < P.CAPS.relLines + 1; i++) {
    P.bump(core, "village", `Person ${i}`, { d: 1, s: `Line number ${i}.` });
  }
  const rows = core.sim.player.rel.village;
  assert.equal(Object.keys(rows).length, P.CAPS.relLines + 1, "every row is still there");
  assert.equal(rows["Person 0"].s, undefined, "the OLDEST line is the one that went");
  assert.deepEqual({ d: rows["Person 0"].d, t: rows["Person 0"].t }, { d: 1, t: 1 }, "and its row kept its ladder");
  assert.equal(
    Object.values(rows).filter((row) => row.s).length,
    P.CAPS.relLines,
    "exactly the cap's worth of lines are held",
  );
  assert.ok(rows[`Person ${P.CAPS.relLines}`].s, "including the newest");

  // Graphemes, not code units: a cut through a surrogate pair renders broken.
  P.bump(core, "village", "Person 0", { s: "🧵".repeat(200) });
  assert.equal(Array.from(rows["Person 0"].s).length, P.CAPS.lineChars, "an over-long line is clipped by grapheme");
});

// (y) THE MUTATORS RE-RESOLVE, FENCE, AND DIRTY THEMSELVES.
// Three properties, one case, because all three failures look the same from the
// outside: state that quietly went to the wrong place. Consumers land in slice
// 6; the contract they will be written against is pinned here.
await withSavePath(async ({ armed, makeCore }) => {
  const P = loadedPF.player;
  const core = makeCore("chat-mutate", 808);
  core.sim.dirty = false;
  armed.length = 0;

  assert.equal(P.grant(core, "apple", 2), 2, "grant returns the new quantity");
  assert.equal(core.sim.dirty, true, "and dirties the sim itself — a consumer cannot forget to");
  assert.deepEqual(
    armed.map((a) => a.ms),
    [2500],
    "and arms the debounce itself, which is what self-dirtying means",
  );

  // FENCED. A mutator that lands after a chat switch belongs to the chat it was
  // written for, and there is no way to tell from `core` alone — both ids moved
  // together. The generation captured when the work STARTED is the only witness.
  const staleGen = loadedPF.save._gen ?? 0;
  loadedPF.save.reset();
  assert.equal(P.grant(core, "apple", 5, staleGen), 0, "a mutation fenced at a generation we have left is a no-op");
  assert.equal(P.take(core, "apple", 1, staleGen), false, "and so is every other one");
  assert.equal(core.sim.player.pouch.items.find((i) => i.t === "apple").q, 2, "the block is untouched");

  // RE-RESOLVED. A mutator that captured core.sim would write into the world the
  // player left behind.
  const previous = core.sim;
  core.sim = new loadedPF.Sim(world.build(809, "cozy-village"));
  P.grant(core, "pear", 1);
  assert.equal(
    core.sim.player.pouch.items.some((i) => i.t === "pear"),
    true,
    "the pear landed in the CURRENT sim",
  );
  assert.equal(
    previous.player.pouch.items.some((i) => i.t === "pear"),
    false,
    "and not in the previous one",
  );

  // All-or-nothing take: a partial one would leave a consumer believing it paid.
  assert.equal(P.take(core, "pear", 2), false, "a take it cannot cover fails whole");
  assert.equal(core.sim.player.pouch.items.find((i) => i.t === "pear").q, 1, "and takes nothing");
  assert.equal(P.take(core, "pear", 1), true, "one it can cover succeeds");
  assert.equal(
    core.sim.player.pouch.items.some((i) => i.t === "pear"),
    false,
    "and empties the row out",
  );

  // The ledger gate: a line the flush has already told is not told again.
  core.sim.player.flushedDay = 5;
  assert.equal(P.log(core, "Already told.", 5), false, "a line at or below the gate is refused");
  assert.equal(P.log(core, "Not yet told.", 6), true, "one above it is not");

  // `home` is a sealed anchor or a derived marker, never a bare h{n}: those move
  // with the mint and would silently rehome the player on the next world change.
  assert.equal(P.setHome(core, "h4"), false, "a minted building id is refused as a home");
  assert.equal(P.setHome(core, "z3"), true, "a sealed anchor is not");
  assert.deepEqual(core.sim.player.home, "z3");
});

// (z) THE DANGLING-QUEST REPAIR IS GATED, AND IT IS NOT A MUTATION.
// Three ways to be wrong here look identical from inside the repair: a world
// that has not been compiled yet, a world whose identity was never checked, and
// a world that is simply the wrong one. Only the last is a statement about the
// quests, and "every giver is missing" is how it announces itself.
{
  const P = loadedPF.player;
  const sealed = brief.defaults("cozy-village", 1001);
  const w = world.build(1001, "cozy-village", sealed);
  const real = sealed.cast[0].name;
  const make = () => {
    const p = P.defaultPlayer();
    p.quests.active = [
      { id: "q-real", g: `z1|${real}`, verb: "gather", target: "herb", n: 1, have: 0, r: {}, day: 1 },
      { id: "q-ghost", g: "z1|Nobody At All", verb: "gather", target: "herb", n: 1, have: 0, r: {}, day: 1 },
    ];
    return p;
  };
  const one = make();
  const out = P.repairQuests(one, w, true);
  assert.equal(out.dropped.length, 1, "a dangling giver among live ones is dropped");
  assert.deepEqual(
    one.quests.active.map((q) => q.id),
    ["q-real"],
    "leaving the quest whose giver is standing there",
  );
  assert.equal(out.notices.length, 1, "with a notice for the ledger");
  // …AND THE NOTICE SAYS WHAT KIND OF THING THIS WAS. The severance notices are
  // about rows that were PARKED and can come home; a dangling giver is a dropped
  // quest and nothing brings it back. Now that the band is a surface a player
  // re-reads rather than one sentence in a wrap-up, the outcome clause is the
  // difference between a notice and an explanation (plan §2.5, M3).
  // Pinned to the WHOLE sentence, exactly as its sibling in (z2) below is: a
  // substring match holds while the clause around it is rewritten into
  // something that no longer says the task is gone for good, which is the half
  // of the copy the review was actually about.
  assert.deepEqual(
    out.notices,
    ["A task you had taken on has no one left to hand it back to, so you have let it go."],
    "…and it says, in full, that the task was let go",
  );

  const all = P.defaultPlayer();
  all.quests.active = [
    { id: "q-a", g: "z1|Nobody", verb: "gather", target: "x", n: 1, have: 0, r: {}, day: 1 },
    { id: "q-b", g: "z1|Nobody Else", verb: "gather", target: "x", n: 1, have: 0, r: {}, day: 1 },
  ];
  assert.equal(P.repairQuests(all, w, true).dropped.length, 0, "EVERY giver dangling is a statement about the world");
  assert.equal(all.quests.active.length, 2, "so the quests are left exactly alone");

  assert.equal(P.repairQuests(make(), w, false).dropped.length, 0, "unevaluated stamps defer the repair");
  assert.equal(P.repairQuests(make(), { ...w, interim: true }, true).dropped.length, 0, "and so does an interim world");

  // A NON-MUTATION: the repair is a read-side correction, not something the
  // player did. The next real save carries it; nothing is armed for it.
  const sim = loadedPF.save.simFromSaved(
    { v: 1, seed: 1001, theme: "cozy-village", player: { v: 1, quests: { active: make().quests.active } } },
    { pixelforgeBrief: sealed },
    "chat-repair",
  );
  assert.deepEqual(
    sim.player.quests.active.map((q) => q.id),
    ["q-real"],
    "the repair runs through the restore path too",
  );
  assert.equal(sim.dirty, false, "and does not dirty the sim — a repair is not a mutation");
  // …and the notice is on the LIVE ledger's BAND, appended after the severance
  // step. Not a line: a notice explains something that happened to the save, and
  // the band is where the panel reads it and where the told flag lives (0.12).
  assert.ok(
    (sim.player.ledger.notices ?? []).some(([, text]) => /no one left/.test(text)),
    "the notice reached the band",
  );
  assert.equal(
    sim.player.ledger.lines.filter(([, text]) => /no one left/.test(text)).length,
    0,
    "…and not the day transcript, which is what the day groups render",
  );
  loadedPF.save.reset();
}

// (z2) A NOTICE IS NOT A LEDGER LINE (0.12 slice 4).
// FIVE writers explain a loss to the player — the two severances, the
// dangling-quest repair, a park refusal and a restore — and every one of them
// used to push its sentence onto `ledger.lines`, where the flush's DAY GATE
// could bury it. The old sink lifted the day to `max(sim.day, flushedDay + 1)`
// to stop that happening, so a save whose gate had run ahead of its clock
// printed a day header FROM THE FUTURE into its own wrap-up. The band is its own
// subtree now and answers to a told flag rather than to the day gate, so the
// shift is deleted and the day a notice carries is the day it happened.
{
  const P = loadedPF.player;
  const Q = loadedPF.quarantine;
  const sealed = brief.defaults("cozy-village", 2201);
  const w = world.build(2201, "cozy-village", sealed);
  const meta = { pixelforgeBrief: sealed };
  const here = P.stampsFor(w, sealed);
  const minted = w.zones[w.startZone].npcs.find((npc) => !sealed.cast.some((member) => member.name === npc.name));
  assert.ok(minted, "the fixture world minted somebody the brief never named");

  const band = (sim) => sim.player.ledger.notices ?? [];
  const texts = (sim) => band(sim).map(([, text]) => text);
  const block = (stamps, extra = {}) => {
    const p = P.defaultPlayer();
    p.world = { ...stamps };
    // A HIGH GATE OVER AN EMPTY BUFFER, which is the shape the day-shift hack was
    // written for and the one it got wrong: with no lines to sever, nothing
    // clamps `flushedDay` back down, so the gate stays ten days ahead of the
    // clock and the old sink filed its notice on day 21 of a day-9 save.
    p.flushedDay = 20;
    Object.assign(p, extra);
    return P.serialize(p);
  };
  const restore = (player, chatId) =>
    loadedPF.save.simFromSaved({ v: 1, seed: 2201, theme: "cozy-village", day: 9, player }, meta, chatId);

  // (1) THE BRIEF SEVERANCE. Its notice is the one thing that survives the window
  // it is explaining, which is why the sink runs after the strip.
  Q.reset();
  const brieved = restore(
    block({ seed: 1, briefHash: 2, mintStamp: 3 }, { rel: { village: { Nobody: { d: 2, t: 3 } } } }),
    "chat-band-brief",
  );
  // THE HACK IS GONE, asserted before anything about the band: with the old sink
  // restored this save's explanation lands on day 21, twelve days after the last
  // day the player has lived, and the wrap-up renders a header from the future.
  assert.deepEqual(
    brieved.player.ledger.lines.filter(([day]) => day > brieved.day),
    [],
    "nothing is filed on a day the clock has not reached",
  );
  assert.equal(texts(brieved).length, 1, "the brief severance wrote one notice");
  assert.ok(/belonged to another world/.test(texts(brieved)[0]), `…the one it means (${texts(brieved)[0]})`);
  assert.equal(band(brieved)[0][0], 9, "AT THE DAY IT HAPPENED — not lifted past a gate sitting at 20");
  assert.deepEqual(brieved.player.ledger.lines, [], "and the day transcript is left empty, not seeded with a notice");
  assert.equal(band(brieved)[0].length, 2, "the row boots UNTOLD: two elements, no flag");

  // (2) THE MINT SEVERANCE, the other half of the same writer.
  Q.reset();
  const minters = restore(
    block({ ...here, mintStamp: here.mintStamp ^ 0xff }, { rel: { village: { [minted.name]: { d: 2, t: 3 } } } }),
    "chat-band-mint",
  );
  assert.ok(
    texts(minters).some((text) => /not the people who live here now/.test(text)),
    `the mint severance's notice is in the band too (${texts(minters)})`,
  );
  assert.equal(band(minters)[0][0], 9, "…on the day it happened");

  // (3) THE DANGLING-QUEST REPAIR, whose notice is about a loss the world caused
  // rather than one the stamps did.
  Q.reset();
  const lost = restore(
    block(here, {
      quests: {
        done_pack: {},
        active: [
          {
            id: "q-real",
            g: `z1|${sealed.cast[0].name}`,
            verb: "gather",
            target: "herb",
            n: 1,
            have: 0,
            r: {},
            day: 1,
          },
          { id: "q-ghost", g: "z1|Nobody At All", verb: "gather", target: "herb", n: 1, have: 0, r: {}, day: 1 },
        ],
      },
    }),
    "chat-band-quest",
  );
  assert.ok(/no one left to hand it back/.test(texts(lost)[0]), `the repair's notice is in the band (${texts(lost)})`);
  assert.equal(band(lost)[0][0], 9, "…on the day it happened");

  // (4) THE PARK REFUSAL, which is the writer that has to CONTRADICT the one
  // above it: applyStamps has already stripped the block by the time the entry is
  // offered to the bag, so a refusal means the comforting sentence is a lie.
  Q.reset();
  assert.equal(
    Q.put("chat-band-refuse", "stamp", {
      reason: "brief",
      fromV: 1,
      stamps: { seed: 1, briefHash: 2, mintStamp: 3 },
      // Sized so the SLOT is legal and the merge is not: the bag unions a second
      // severance into the first, and this one leaves it no room to union into.
      fields: { rel: { z: { Huge: { d: 0, t: 0, s: "x".repeat(130_880) } } } },
    }),
    true,
    "the bag is holding an earlier severance that fills it to the brim",
  );
  const refused = restore(
    block({ seed: 1, briefHash: 2, mintStamp: 3 }, { rel: { village: { Nobody: { d: 2, t: 3 } } } }),
    "chat-band-refuse",
  );
  assert.deepEqual(
    texts(refused),
    ["What you had done in the world that changed could not be kept, and is gone."],
    "a severance the bag would not take says the TRUE sentence, and only that one",
  );
  assert.equal(band(refused)[0][0], 9, "…on the day it happened");

  // (5) THE RESTORE, the one notice that is good news.
  Q.reset();
  assert.equal(
    Q.put("chat-band-home", "stamp", {
      reason: "brief",
      fromV: 1,
      stamps: { ...here },
      fields: { ledgerLines: [[4, "Something from before the window."]], flushedDay: 3 },
    }),
    true,
    "a stamp slot whose stamps are this world's own is a save coming home",
  );
  const homed = restore(block(here), "chat-band-home");
  assert.ok(/is back/.test(texts(homed)[0]), `the restore's notice is in the band (${texts(homed)})`);
  assert.equal(band(homed)[0][0], 9, "…on the day it happened");
  assert.ok(
    homed.player.ledger.lines.some(([day]) => day === 4),
    "…and the lines it brought home are lines, not notices",
  );

  // …AND THE BAND THE LIVE BLOCK ARRIVED WITH IS STILL THERE. The restore brings
  // the parked LINES home by reassigning `player.ledger` whole, and the band is
  // not a line and was never parked: it rode in on the block's own disk state,
  // carrying sentences nobody has been told yet. A whole-object reassignment
  // forgets that and takes them with it — and the mint branch beside it, which
  // touches the ledger not at all, keeps them. Two branches of one restore cannot
  // disagree about whether a pending notice survives coming home.
  Q.reset();
  assert.equal(
    Q.put("chat-band-carry", "stamp", {
      reason: "brief",
      fromV: 1,
      stamps: { ...here },
      fields: { ledgerLines: [[4, "Something from before the window."]], flushedDay: 3 },
    }),
    true,
    "the same slot, and this time the live block has a band of its own",
  );
  const carried = restore(
    block(here, { ledger: { lines: [], notices: [[8, "Something nobody has been told yet."]] } }),
    "chat-band-carry",
  );
  assert.ok(
    texts(carried).includes("Something nobody has been told yet."),
    `the untold notice survived the restore (${texts(carried)})`,
  );
  assert.equal(
    band(carried).find(([, text]) => text === "Something nobody has been told yet.")[2],
    undefined,
    "…and is STILL UNTOLD, because coming home is not being told",
  );
  assert.ok(
    texts(carried).some((text) => /is back/.test(text)),
    "…beside the restore's own notice, which appends after it as it always did",
  );
  assert.ok(
    carried.player.ledger.lines.some(([day]) => day === 4),
    "…and the parked lines still came home",
  );

  Q.reset();
  loadedPF.save.reset();

  // ── THE CAP EVICTS THE TOLD ONES FIRST ───────────────────────────────────────
  // An untold notice is a sentence nobody has been given yet; a told one is only
  // still here so the panel can show it. So the band spends the told rows first
  // and only eats an untold one when there is nothing else left to eat.
  {
    const p = P.defaultPlayer();
    for (let i = 0; i < P.CAPS.notices; i++) P.notice(p, `notice ${i}`, i + 1);
    assert.equal(p.ledger.notices.length, P.CAPS.notices, "the band fills to its cap");
    // THE OLDEST ROWS ARE UNTOLD AND THE TOLD ONES ARE NEWER, which is the whole
    // fixture: evict by age alone and rows 0 and 1 go, and the player is never
    // given two sentences that were still waiting for them.
    p.ledger.notices[3][2] = 1;
    p.ledger.notices[7][2] = 1;
    P.notice(p, "the thirteenth", 99);
    assert.equal(p.ledger.notices.length, P.CAPS.notices, "…and stays there");
    assert.ok(!p.ledger.notices.some(([, text]) => text === "notice 3"), "the OLDEST TOLD row is what went");
    assert.ok(
      p.ledger.notices.some(([, text]) => text === "notice 0"),
      "…and not the older UNTOLD one in front of it",
    );
    assert.ok(
      p.ledger.notices.some(([, text]) => text === "notice 7"),
      "…nor the newer told one behind it, which is still one told row too many to spend",
    );
    assert.ok(
      p.ledger.notices.some(([, text]) => text === "the thirteenth"),
      "the newcomer is in",
    );

    // …AND AN ALL-UNTOLD BAND STILL EVICTS, because a cap that cannot bite is not
    // a cap. The oldest goes, which is the only order left to it.
    const fresh = P.defaultPlayer();
    for (let i = 0; i < P.CAPS.notices + 3; i++) P.notice(fresh, `untold ${i}`, i + 1);
    assert.equal(fresh.ledger.notices.length, P.CAPS.notices, "the cap holds against nothing but untold rows");
    assert.deepEqual(
      [fresh.ledger.notices[0][1], fresh.ledger.notices.at(-1)[1]],
      ["untold 3", `untold ${P.CAPS.notices + 2}`],
      "…by dropping the three oldest",
    );
  }

  // ── THE WIRE: EMITTED ONLY WHEN THERE IS SOMETHING TO EMIT ───────────────────
  // The `bought` precedent, one level down. A band nobody has written into must
  // cost a save nothing at all, or every row in the wild gains an empty array on
  // its first load — undeclared byte drift on a wire other builds read.
  {
    const empty = P.serialize(P.defaultPlayer());
    assert.deepEqual(empty.ledger, { lines: [] }, "an unwritten band emits NOTHING, not an empty array");
    assert.equal(
      JSON.stringify(P.serialize(P.parse(JSON.parse(JSON.stringify(empty))).player).ledger),
      '{"lines":[]}',
      "…and a legacy block round-trips to the same bytes it arrived as",
    );

    const written = P.defaultPlayer();
    P.notice(written, "  a notice   with loose  spacing ", 4);
    P.notice(written, "y".repeat(P.CAPS.ledgerChars + 40), 5);
    written.ledger.notices[1][2] = 1;
    const wire = JSON.parse(JSON.stringify(P.serialize(written)));
    assert.deepEqual(
      wire.ledger.notices[0],
      [4, "a notice with loose spacing"],
      "a written band rides the wire, clipped the way every other line is",
    );
    assert.equal(wire.ledger.notices[1].length, 3, "…and the TOLD flag is the optional third element");
    assert.equal(wire.ledger.notices[1][1].length, P.CAPS.ledgerChars, "…with the text held to the ledger's own cap");

    // TOLERANT ON THE WAY BACK IN, exactly as the lines beside it are: a row that
    // is not a row is dropped, and a `notices` that is not an array is no band.
    //
    // …AND A ROW WITH NOTHING TO SAY IS NOT A ROW EITHER. `notice()` refuses text
    // that clips to nothing, so nothing this build writes can be one; a hostile
    // save can carry `[3, "   "]` or a number where the sentence goes, and both
    // used to survive as `[3, ""]` — a band row costing bytes on the wire and a
    // blank line in the panel that no writer could ever explain.
    const hostile = P.parse({
      ...wire,
      ledger: {
        lines: [],
        notices: [[3, "kept"], "not a row", [], [7, "told", 9], { day: 1 }, [5, "   "], [6, 42], [8, "", 1]],
      },
    }).player;
    assert.deepEqual(
      hostile.ledger.notices,
      [
        [3, "kept"],
        [7, "told", 1],
      ],
      "the shapes that are rows survive, the flag normalizes to 1, and the empty ones are dropped",
    );
    assert.equal(P.parse({ ...wire, ledger: { lines: [], notices: "band" } }).player.ledger.notices, undefined);
    assert.equal(
      P.serialize({ ...P.defaultPlayer(), ledger: { lines: [], notices: [[3, " \t "]] } }).ledger.notices,
      undefined,
      "…and a band that is nothing but empty rows emits no band at all",
    );

    // …AND THE 0.11 STRIP, WHICH IS A DOCUMENTED LOSS AND NOT A BUG (plan §5). A
    // 0.11 client rebuilds `ledger` as `{lines}` and knows nothing about a band,
    // so a visit from one takes the pending notices with it, permanently. Pinned
    // as the shape of that loss: rebuild the ledger without the band and the
    // notices are gone, while everything else about the block round-trips.
    const visited = JSON.parse(JSON.stringify(wire));
    visited.ledger = { lines: wire.ledger.lines };
    const after = P.parse(visited).player;
    assert.equal(after.ledger.notices, undefined, "a 0.11 visit strips the band — informational strings, no self-heal");
    assert.equal(after.flushedDay, wire.flushedDay, "…while the day gate, which is not in the band, comes back");
  }
}

// (aa) THE BRIEF-ARRIVAL TRANSPLANT SPLITS THE BLOCK, IT DOES NOT CARRY IT.
// A chat created before the loading gate boots on a throwaway world and rebuilds
// when the generated brief seals (one release of backward compatibility). The
// purse crosses; the people do not. Reinterpreting "Maud Thatch owes you a
// favour" against a world where Maud Thatch does not exist is the bug this seam
// would otherwise ship.
await withSavePath(async ({ makeCore }) => {
  const P = loadedPF.player;
  const realGenerate = brief.generate;
  const savedAssets = { status: loadedPF.assets.status, noPackage: loadedPF.assets._noPackage };
  brief.generate = async () => brief.defaults("cozy-village", 3311);
  try {
    const meta = { gameSetupConfig: { experienceConfig: { seed: 3311, theme: "cozy-village", generate: true } } };
    const core = makeCore("chat-transplant", 3311);
    core.host.chatMeta = meta;
    core.sim = loadedPF.save.simFromSaved(null, meta, core.chatId);
    assert.equal(core.sim.world.interim, true, "the fixture really is a pre-brief throwaway world");
    P.grant(core, { t: "rod", k: "fine" }, 1);
    P.award(core, { money: 25, xp: 4, verb: "fishing" });
    P.bump(core, "village", "Somebody From The Throwaway", { d: 2, t: 4 });
    P.log(core, "Something that happened before the world existed.", 1);
    P.setHome(core, "village");

    await loadedPF.save.maybeGenerateBrief(core);

    assert.ok(core.sim.world.brieved, "the generated world replaced the throwaway one");
    assert.equal(core.sim.player.pouch.money, 25, "the purse crossed — it means the same thing in any world");
    assert.equal(core.sim.player.skills.verbs.fishing.x, 4, "and so did the skill");
    assert.ok(
      core.sim.player.pouch.items.some((i) => i.t === "rod"),
      "and the rod",
    );
    assert.deepEqual(core.sim.player.rel, {}, "the relationship did NOT — that person does not live here");
    assert.deepEqual(core.sim.player.ledger.lines, [], "nor the ledger line");
    assert.equal(core.sim.player.home, null, "nor the home anchor");
    const parked = loadedPF.quarantine.peek("stamp");
    assert.ok(parked, "all of which is in the stamp slot rather than deleted");
    assert.ok(parked.fields.rel.village["Somebody From The Throwaway"], "verbatim");
    assert.deepEqual(
      core.sim.player.world,
      P.stampsFor(core.sim.world, brief.defaults("cozy-village", 3311)),
      "and the block is re-stamped for the world that actually arrived",
    );
  } finally {
    brief.generate = realGenerate;
    loadedPF.assets.status = savedAssets.status;
    loadedPF.assets._noPackage = savedAssets.noPackage;
  }
});

// ═══ THE DECISION LADDER (S5 slice 4) ══════════════════════════════════════

// (ab) EVERY ROW, MOCKED, WITH THE ACTION EACH SITE TAKES ON IT.
// One implementation and three consumers means the table below IS the contract:
// a row whose meaning drifts at one site and not another is exactly the class of
// bug slice 4 exists to close.
{
  // `seqAtIssue: undefined` means "no own-commit question was asked" — _writeSeq
  // is module-private and the classifier reads it directly, so the row-5 case
  // below passes a sequence that cannot possibly be the current one instead.
  const ladder = (probe, ctx) =>
    loadedPF.save.classify(
      probe === null ? { failed: true, error: new TypeError("NetworkError") } : { failed: false, probe },
      { serverSerialized: null, localSerialized: '{"mine":1}', game: 1, now: Date.now(), ...ctx },
    );
  const ok = (state, extra) => ({ available: true, status: 200, body: { exists: true, state, ...extra } });

  const rows = [
    ["route absent", ladder({ available: false, status: 404 }), 0, { adopt: "metadata", flush: "proceed" }],
    [
      "engine says unparseable",
      ladder(ok(null, { rawState: '{"zone":"vil' })),
      1,
      { rewind: "ignore", flush: "proceed" },
    ],
    ["older engine, inferred", ladder(ok(null)), 1, { rewind: "ignore", flush: "proceed" }],
    ["not even an object", ladder(ok("a string")), 1, { rewind: "ignore", flush: "proceed" }],
    ["a retired game's row", ladder(ok({ v: 1, player: { game: 2 } })), 2, { rewind: "ignore", flush: "proceed" }],
    ["a pre-S5 row after New game", ladder(ok({ v: 1, zone: "village" }), { game: 3 }), 2, { flush: "proceed" }],
    [
      "no row, none expected",
      ladder({ available: true, body: { exists: false } }),
      3,
      { adopt: "first-write", flush: "proceed" },
    ],
    [
      "no row, but we held one",
      ladder({ available: true, body: { exists: false } }, { serverSerialized: '{"was":1}' }),
      4,
      { rewind: "reread", flush: "block" },
    ],
    [
      "our own PUT overtook the GET",
      ladder(ok({ v: 1, moved: true }), { seqAtIssue: -1 }),
      5,
      { rewind: "ignore", flush: "proceed" },
    ],
    [
      "a row, and no anchor of ours",
      ladder(ok({ v: 1, other: true })),
      6,
      { adopt: "rebuild", rewind: "latch", flush: "proceed" },
    ],
    [
      "the row moved under our anchor",
      ladder(ok({ v: 1, other: true }), { serverSerialized: '{"was":1}' }),
      7,
      { rewind: "rewind", flush: "block" },
    ],
    ["byte-identical to ours", ladder(ok({ mine: 1 })), 8, { adopt: "none", rewind: "latch", flush: "proceed" }],
    ["the probe did not answer", ladder(null), 9, { rewind: "none", flush: "fresh" }],
  ];
  for (const [label, got, row, actions] of rows) {
    assert.equal(got.row, row, `${label} is row ${row}, not ${got.row}`);
    for (const [site, action] of Object.entries(actions)) {
      assert.equal(got[site], action, `${label}: at the ${site} site it means "${action}", not "${got[site]}"`);
    }
  }
  // The two rows that must never become "what the server holds": overwriting
  // either is the plan, and latching one would make the next honest difference
  // read as a rewind.
  assert.equal(rows[1][1].anchorCache, false, "a damaged row never becomes the anchor");
  assert.equal(rows[4][1].anchorCache, false, "and neither does a retired game's row");

  // The ordinal predicate is TOTAL. Every one of these reads as game 1, which is
  // what every row written before S5 is.
  for (const player of [undefined, null, {}, { game: null }, { game: "2" }, { game: NaN }]) {
    const got = ladder(ok({ v: 1, player }));
    assert.notEqual(got.row, 2, `a row whose player is ${JSON.stringify(player)} is not foreign to game 1`);
  }
  // Row 9's freshness is a window, not a flag.
  assert.equal(ladder(null, { lastOkCheckAt: Date.now() }).fresh, true, "a check from a moment ago is fresh");
  assert.equal(ladder(null, { lastOkCheckAt: Date.now() - 60_000 }).fresh, false, "one from a minute ago is not");
  assert.equal(ladder(null, { lastOkCheckAt: 0 }).fresh, false, "and never having checked is not fresh either");
}

// (ac) A FOREIGN-ORDINAL ROW AT THE TURN EDGE DOES NOT REBUILD.
// "New game" retires the old world but deletes nothing (plan §8 #5) — the rows
// stay, inert, until the player exports or deletes them. Inert has to mean inert
// at the turn edge too, or the first swipe after a New game hands the player
// their old world back with a toast telling them the story rewound.
await withSavePath(async ({ behavior, makeCore }) => {
  loadedPF.save.mode = "routes";
  const core = makeCore("chat-newgame", 909);
  core.sim.player.game = 2; // the player started a new game
  await loadedPF.save.flush(core, false); // establish an anchor of our own
  const anchored = loadedPF.save._serverSerialized;
  const worldBefore = core.sim.world;
  core.toasts.length = 0;

  // The row at this anchor belongs to game 1 — a whole world, saved before the
  // New game, sitting at an anchor that survived.
  const oldGame = { v: 1, seed: 1, theme: "cozy-village", zone: "forest", day: 40, player: { v: 1, game: 1 } };
  behavior.get = async () => ({ available: true, status: 200, body: { exists: true, state: oldGame } });
  await loadedPF.save.checkRewind(core);
  assert.equal(core.sim.world, worldBefore, "a foreign-ordinal row at the turn edge does not rebuild");
  assert.deepEqual(core.toasts, [], "and says nothing");
  assert.equal(loadedPF.save._serverSerialized, anchored, "and never becomes the anchor");

  // A PRE-S5 row is the same case with the ordinal missing entirely, which is
  // the one that actually ships: every row written before this slice looks
  // exactly like this.
  const preS5 = { v: 1, seed: 1, theme: "cozy-village", zone: "inn", day: 12 };
  behavior.get = async () => ({ available: true, status: 200, body: { exists: true, state: preS5 } });
  await loadedPF.save.checkRewind(core);
  assert.equal(core.sim.world, worldBefore, "a pre-S5 row at a surviving anchor does not rebuild after New game");
  assert.deepEqual(core.toasts, [], "silently");

  // …and the flush writes straight over it, because ours is the live game.
  behavior.get = async () => ({ available: true, status: 200, body: { exists: true, state: preS5 } });
  loadedPF.save._lastCheckAt = 0; // force the pre-check to actually run
  core.sim.day += 1;
  await loadedPF.save.flush(core, false);
  assert.equal(loadedPF.save._lastSerialized, JSON.stringify(loadedPF.save.snapshot(core)), "the PUT proceeded");
});

// (ad) AN UNPARSEABLE ROW AT THE TURN EDGE DOES NOT REBUILD, AND THE WRITE IS
// THE REPAIR. Engine #5407 hands the damaged text back on the failure path only,
// so the key's PRESENCE is the signal. Rebuilding from `state: null` would drop
// the player into a baseline world; the row is simply overwritten instead, and
// the bytes are parked first because nothing client-side can read them back.
await withSavePath(async ({ calls, behavior, tick, makeCore }) => {
  loadedPF.save.mode = "routes";
  const core = makeCore("chat-corrupt", 1010);
  await loadedPF.save.flush(core, false);
  const anchored = loadedPF.save._serverSerialized;
  const worldBefore = core.sim.world;
  core.toasts.length = 0;

  behavior.get = async () => ({
    available: true,
    status: 200,
    body: { exists: true, state: null, rawState: '{"zone":"village","x":5', rawStateTruncated: false },
  });
  await loadedPF.save.checkRewind(core);
  assert.equal(core.sim.world, worldBefore, "an unparseable row at the turn edge does not rebuild");
  assert.deepEqual(core.toasts, [], "and the turn edge says nothing about it");
  assert.equal(loadedPF.save._serverSerialized, anchored, "it never becomes the anchor either");

  // At ADOPT it is a different job: boot from metadata, tell the player once,
  // and park the evidence before the repairing write destroys it.
  loadedPF.save.reset();
  calls.length = 0;
  const fresh = makeCore("chat-corrupt-boot", 1011);
  fresh.host.chatMeta = {};
  behavior.get = async () => ({
    available: true,
    status: 200,
    body: { exists: true, state: null, rawState: "x".repeat(9_000), rawStateTruncated: true },
  });
  await loadedPF.save.adopt(fresh);
  await tick();
  assert.equal(loadedPF.save.mode, "routes", "the route is fine — the row is not");
  assert.equal(fresh.toasts.length, 1, "the player is told once");
  const parked = calls.find((c) => c.kind === "patch" && c.patch.pixelforgeCorruptExcerpt);
  assert.ok(parked, "the damaged text is parked under its own key");
  assert.equal(parked.patch.pixelforgeCorruptExcerpt.text.length, 4_096, "bounded — evidence, not a backup");
  assert.equal(parked.patch.pixelforgeCorruptExcerpt.truncated, true, "and flagged when it did not all fit");
  assert.equal(loadedPF.save._serverSerialized, null, "the damaged row is not the anchor");
  assert.equal(loadedPF.save._lastSerialized, null, "and the next write is forced — the write IS the repair");

  // A later healthy adopt takes the key away again.
  loadedPF.save.reset();
  calls.length = 0;
  const healed = makeCore("chat-corrupt-boot", 1011);
  healed.host.chatMeta = { pixelforgeCorruptExcerpt: { at: "then", text: "x" } };
  behavior.get = async () => ({ available: true, status: 200, body: { exists: false } });
  await loadedPF.save.adopt(healed);
  await tick();
  const cleared = calls.find((c) => c.kind === "patch" && "pixelforgeCorruptExcerpt" in c.patch);
  assert.ok(cleared, "the next healthy adopt clears it");
  assert.equal(cleared.patch.pixelforgeCorruptExcerpt, null, "(nulled — the metadata PATCH has no delete convention)");
});

// (ae) THE FIRST FLUSH OF A FRESH CHAT CREATES A ROW.
// The pre-check is a gate in front of every routes-mode write, and the very
// first write of a chat is the one that has nothing to compare against. Row 3
// exists so that case proceeds rather than being blocked by its own novelty.
await withSavePath(async ({ calls, behavior, makeCore }) => {
  loadedPF.save.mode = "routes";
  const core = makeCore("chat-firstwrite", 1212);
  behavior.get = async () => ({ available: true, status: 200, body: { exists: false } });
  await loadedPF.save.flush(core, false);
  assert.deepEqual(
    calls.map((c) => c.kind),
    ["get", "put", "patch"],
    "the pre-check looks, finds nothing, and the write creates the row",
  );
  assert.equal(loadedPF.save._lastCheck.row, 3, "on row 3 — no row, and none expected");
  assert.equal(calls[1].state.zone, core.sim.zoneId, "carrying this world");

  // …and the SECOND write inside one debounce window does not re-check. The
  // pre-check exists so a PUT never lands on a row nobody looked at; a check
  // taken a moment ago looked at it.
  calls.length = 0;
  behavior.get = async () => ({
    available: true,
    status: 200,
    body: { exists: true, state: JSON.parse(loadedPF.save._lastSerialized) },
  });
  core.sim.day += 1;
  await loadedPF.save.flush(core, false);
  assert.deepEqual(
    calls.map((c) => c.kind),
    ["put", "patch"],
    "a fresh check is spent rather than re-taken",
  );

  // Once it goes stale, the check happens again.
  calls.length = 0;
  loadedPF.save._lastCheckAt = Date.now() - 60_000;
  core.sim.day += 1;
  await loadedPF.save.flush(core, false);
  assert.deepEqual(
    calls.map((c) => c.kind),
    ["get", "put", "patch"],
    "a stale one is re-taken",
  );
});

// (af) THE TWO ROWS THAT BLOCK A WRITE, AND THE ONE THAT BLOCKS A TEARDOWN.
// A blocking row is not a write failure: the server is fine, the timeline moved.
// So it must not spend a backoff rung, and the rewind it triggers is what re-arms.
await withSavePath(async ({ armed, calls, behavior, makeCore }) => {
  loadedPF.save.mode = "routes";
  const core = makeCore("chat-block", 1313);
  await loadedPF.save.flush(core, false);
  core.toasts.length = 0;
  calls.length = 0;
  armed.length = 0;

  // ROW 7 — the row under our anchor moved. The write is refused and the world
  // is rebuilt onto the row instead.
  const moved = { v: 1, seed: 1313, theme: "cozy-village", zone: "inn", day: 30, player: { v: 1, game: 1 } };
  behavior.get = async () => ({ available: true, status: 200, body: { exists: true, state: moved } });
  loadedPF.save._lastCheckAt = 0;
  core.sim.day += 1;
  await loadedPF.save.flush(core, false);
  assert.equal(calls.filter((c) => c.kind === "put").length, 0, "row 7 blocks the write");
  assert.equal(core.sim.zoneId, "inn", "and rewinds the world onto the row");
  assert.deepEqual(core.toasts, ["The world rewound with the story."], "with the one toast that says so");
  assert.equal(loadedPF.save._flushFailures, 0, "a blocked write is not a failed write — no rung is spent");

  // ROW 4 — the row is gone. ONE re-read first: a GET landing inside the PUT
  // route's delete-then-insert window sees no row and would rewind a live world.
  loadedPF.save.reset();
  loadedPF.save.mode = "routes";
  const core2 = makeCore("chat-lost", 1414);
  await loadedPF.save.flush(core2, false);
  core2.toasts.length = 0;
  calls.length = 0;
  let gets = 0;
  behavior.get = async () => {
    gets += 1;
    // The first read misses; the second finds the row exactly where it was.
    return gets === 1
      ? { available: true, status: 200, body: { exists: false } }
      : { available: true, status: 200, body: { exists: true, state: JSON.parse(loadedPF.save._serverSerialized) } };
  };
  await loadedPF.save.checkRewind(core2);
  assert.equal(gets, 2, "row 4 re-reads once before believing the row is gone");
  assert.deepEqual(core2.toasts, [], "and a row that was only briefly invisible rewinds nothing");

  gets = 0;
  behavior.get = async () => {
    gets += 1;
    return { available: true, status: 200, body: { exists: false } };
  };
  await loadedPF.save.checkRewind(core2);
  assert.equal(gets, 2, "a genuinely missing row costs the same two reads");
  assert.deepEqual(core2.toasts, ["The world rewound with the story."], "and then rewinds to the baseline");
  assert.equal(loadedPF.save._serverSerialized, null, "dropping the anchor it no longer has");

  // THE TEARDOWN GATE, derived. Teardown takes no GET of its own — the page is
  // going away — so it spends the last completed check's verdict.
  loadedPF.save.reset();
  loadedPF.save.mode = "routes";
  const core3 = makeCore("chat-teardown-gate", 1515);
  assert.equal(loadedPF.save._teardownAllowed(), true, "never having checked is a proceed — that is a fresh chat");
  for (const row of [4, 7]) {
    loadedPF.save._lastCheck = { row, flush: "block" };
    assert.equal(loadedPF.save._teardownAllowed(), false, `row ${row} blocks the teardown write`);
  }
  for (const row of [1, 2, 3, 5, 6, 8]) {
    loadedPF.save._lastCheck = { row, flush: "proceed" };
    assert.equal(loadedPF.save._teardownAllowed(), true, `row ${row} does not`);
  }
  // Row 9 under its freshness condition, driven for real: a probe that threw.
  behavior.get = async () => {
    throw new TypeError("NetworkError when attempting to fetch resource");
  };
  await loadedPF.save.checkRewind(core3);
  assert.equal(loadedPF.save._lastCheck.row, 9, "the failed probe is the last completed check");
  loadedPF.save._lastOkCheckAt = Date.now() - 60_000;
  assert.equal(loadedPF.save._teardownAllowed(), false, "row 9 blocks once its last successful check has gone stale");
  loadedPF.save._lastOkCheckAt = Date.now();
  assert.equal(loadedPF.save._teardownAllowed(), true, "and proceeds while it is still fresh");

  // …and the two clocks are NOT one clock (slice-4 fix). A row-4 check ANSWERS,
  // so it moves the answered-clock the pre-check's skip window measures — but it
  // found the row GONE, which is the opposite of "we looked and it was fine".
  // Sharing one field let an unresolved lost-row check make the very next
  // teardown look fresh and ship a full-snapshot overwrite on the strength of it.
  loadedPF.save._lastOkCheckAt = 0;
  loadedPF.save._recordCheck({ row: 4, flush: "block", anchor: null });
  assert.ok(loadedPF.save._lastCheckAt > 0, "a row-4 check answered, so the answered-clock moves");
  assert.equal(loadedPF.save._lastOkCheckAt, 0, "but it found no row, so the last-OK clock does not");
  loadedPF.save._lastCheck = { row: 9, flush: "fresh" };
  assert.equal(
    loadedPF.save._teardownAllowed(),
    false,
    "so a row 9 behind an unresolved row 4 is not fresh, however recently the row 4 answered",
  );
  // An echoed anchor MOVE cancels freshness outright: whatever we last saw, we
  // did not see it at the anchor this write would land on.
  loadedPF.save._lastOkCheckAt = Date.now();
  loadedPF.save._anchorMoved = true;
  assert.equal(loadedPF.save._teardownAllowed(), false, "and a moved anchor is not fresh at any age");
  loadedPF.save._anchorMoved = false;

  // METADATA MODE HAS NO ROW IN THE CLEAN-SET. The gate is derived from the
  // ROUTE ladder; a boot probe that failed picks metadata mode AND leaves its
  // row 9 behind, and reading that row 9 as a verdict about a metadata key the
  // PATCH owns outright refused every teardown write for the rest of the session.
  loadedPF.save.mode = "metadata";
  loadedPF.save._lastCheck = { row: 9, flush: "fresh" };
  loadedPF.save._lastOkCheckAt = 0;
  assert.equal(loadedPF.save._teardownAllowed(), true, "a metadata-mode teardown is not gated on a route row");
  loadedPF.save._lastCheck = { row: 7, flush: "block" };
  assert.equal(loadedPF.save._teardownAllowed(), true, "not even by a row that blocks in routes mode");
  loadedPF.save.mode = "routes";

  calls.length = 0;
  loadedPF.save._lastCheck = { row: 7, flush: "block" };
  core3.sim.day += 1;
  loadedPF.save.flushTeardown(core3);
  assert.equal(calls.length, 0, "so a teardown after a blocking check writes nothing at all");
});

// (ag) THE PUT-ANCHOR ECHO. The row lands at whatever the visible anchor is when
// the write is SERVED, and a turn can finish between the check and the write.
// Two consequences: the next flush may not spend the stale check, and a
// difference found at the anchor we never looked at is a rewind, not a latch.
await withSavePath(async ({ calls, behavior, makeCore }) => {
  loadedPF.save.mode = "routes";
  const core = makeCore("chat-echo", 1616);
  behavior.get = async () => ({
    available: true,
    status: 200,
    body: { exists: false, anchor: { messageId: "m1", swipeIndex: 0 } },
  });
  behavior.put = async () => ({ ok: true, id: "row1", anchor: { messageId: "m1", swipeIndex: 0 } });
  await loadedPF.save.flush(core, false);
  assert.equal(loadedPF.save._anchorMoved, false, "a write that landed where we looked moves nothing");

  // The turn finished mid-write.
  calls.length = 0;
  behavior.put = async () => ({ ok: true, id: "row2", anchor: { messageId: "m2", swipeIndex: 0 } });
  core.sim.day += 1;
  await loadedPF.save.flush(core, false);
  assert.equal(loadedPF.save._anchorMoved, true, "an echo from an anchor we never checked is recorded");

  // …so the very next flush re-checks even though the last check is seconds old.
  calls.length = 0;
  behavior.put = async () => ({ ok: true, id: "row2", anchor: { messageId: "m2", swipeIndex: 0 } });
  behavior.get = async () => ({
    available: true,
    status: 200,
    body: {
      exists: true,
      state: JSON.parse(loadedPF.save._serverSerialized),
      anchor: { messageId: "m2", swipeIndex: 0 },
    },
  });
  core.sim.day += 1;
  await loadedPF.save.flush(core, false);
  assert.deepEqual(
    calls.map((c) => c.kind),
    ["get", "put", "patch"],
    "the freshness of a check taken at a different anchor is not spent",
  );
  assert.equal(loadedPF.save._anchorMoved, false, "and the flag is consumed by the check it forced");

  // And with no anchor of our own, a moved echo still routes a difference down
  // the rewind path rather than latching it in silence.
  const decided = loadedPF.save.classify(
    { failed: false, probe: { available: true, body: { exists: true, state: { v: 1, someone: "else" } } } },
    { serverSerialized: null, localSerialized: '{"mine":1}', game: 1, anchorMoved: true },
  );
  assert.equal(decided.row, 7, "a difference at an anchor we never checked is row 7, not row 6");
  assert.equal(decided.rewind, "rewind", "which is the rewind path");
});

// ── S5 SLICE 3-4 GATE FIXES ──────────────────────────────────────────────────

// (ah) THE MAX SHAPE, MEASURED — what a fully-played world actually weighs, and
// whether it clears the walls that really exist. There is no size budget any
// more (maintainer ruling, round 2: the 24 KB figure was inherited caution and
// what it bought was tiny settlements), so this case asserts against the two
// REAL walls and nothing else:
//
//   · MAX_SNAPSHOT_CHARS — 262,144, mirroring the Engine row cap the server
//     422s above. This binds EVERY write, and tripping it degrades the session
//     for good, so the margin here is the one that matters.
//   · The keepalive pair quota — 57,000 bytes for the PAIR, and it binds the
//     pagehide TEARDOWN path only. Reported here, not asserted as a general
//     bound: an ordinary flush is not subject to it, and case (j) is where the
//     teardown path's own behaviour over that quota is pinned. A saturated world
//     is OVER it (the printed numbers say by how much), which is not a failure:
//     flushTeardown's documented answer is to send the route PUT alone and let
//     the write-through cache repair on the next load. Losing the cache PATCH at
//     pagehide is repairable; losing both is the session.
//
// The measurement itself stays, because a cap that moves should say by how much
// and in which direction. Saturation is driven through the SHIPPED MUTATORS
// only: a hand-built object could satisfy this while the real code path could
// not reach the same shape.
{
  const P = loadedPF.player;
  const CAPS = P.CAPS;
  const wide = (prefix, n, width) => (prefix + n).padEnd(width, "x").slice(0, width);
  // Field widths are the ones the shipped code actually produces: the brief
  // validator caps a cast name at 24 (18-brief capText), zone and place anchors
  // are <= 4 chars ("z12", "h4b"), and the board's own comment names its quest
  // ids ("b1.d37.2").
  const saturate = (scale) => {
    const cast = [];
    for (let i = 0; i < 24; i++) {
      cast.push({
        name: wide("Cast", i, 24),
        role: "trader",
        kind: i % 5 === 0 ? "merchant" : "folk",
        tint: "amber",
        home: "Greatmarket",
        household: 1 + (i % 9),
      });
    }
    const sealed = brief.validate(
      {
        scale,
        name: "Greatmarket",
        prosperity: "thriving",
        backgroundPopulation: 400,
        situation: "The harbour tax has not been collected in three seasons and everyone knows whose fault it is.",
        cast,
      },
      { theme: "cozy-village", seed: 987654 },
    );
    const w = world.build(987654, "cozy-village", sealed);
    const sim = new loadedPF.Sim(w);
    const core = { chatId: "chat-maxshape", sim, hud: { toast() {}, refreshChips() {} } };
    const zoneIds = Object.keys(w.zones);
    for (let i = 0; i < CAPS.items + 5; i++) P.grant(core, { t: wide("item.", i, 16), k: wide("tier", i, 8) }, 99);
    P.award(core, { money: 999_999 });
    for (const verb of ["fishing", "foraging", "mining", "crafting", "cooking", "trading", "mending", "hauling"]) {
      P.award(core, { xp: 100_000, verb });
      P.equip(core, verb, "tool", { t: wide("tool.", verb, 16), k: wide("tier", 1, 8) });
      P.equip(core, verb, "mod", { t: wide("mod.", verb, 16), k: wide("tier", 2, 8) });
    }
    let placed = 0;
    for (let i = 0; placed < CAPS.relRows + 10 && i < 4000; i++) {
      const patch = { d: i % 4, t: 40 + (i % 7) };
      if (placed < CAPS.relLines + 6) patch.s = "x".repeat(CAPS.lineChars + 20);
      if (i % 11 === 0) patch.h = true;
      if (P.bump(core, zoneIds[i % zoneIds.length], wide("Cast", i, 24), patch)) placed += 1;
    }
    for (let i = 0; i < CAPS.boardDone + 6; i++) {
      const id = wide("b1.d", i, 12);
      P.quest(core, "accept", {
        id,
        g: `z1|${wide("Cast", i, 24)}`,
        verb: "hauling",
        target: wide("item.", i, 16),
        n: 3,
      });
      P.quest(core, "complete", { id, template: id });
    }
    for (let i = 0; i < CAPS.packDone + 6; i++) {
      const id = `p:${wide("pack.", i, 18)}`;
      P.quest(core, "accept", {
        id,
        g: `z1|${wide("Cast", i, 24)}`,
        verb: "mending",
        target: wide("item.", i, 16),
        n: 3,
      });
      P.quest(core, "complete", { id, template: id });
    }
    for (let i = 0; i < CAPS.activeQuests + 4; i++) {
      P.quest(core, "accept", {
        id: wide("b3.a", i, 12),
        g: `z2|${wide("Cast", i, 24)}`,
        verb: "foraging",
        target: wide("item.", i, 16),
        n: 9,
        r: { money: 250, xp: 120 },
        day: 40 + i,
      });
    }
    // `bought` has no mutator yet — it is the optional stock-table seam — so it
    // is filled directly and then normalized by the same serializer.
    sim.player.bought = {};
    for (let i = 0; i < CAPS.bought; i++) {
      const shop = wide("s", i % 6, 4);
      (sim.player.bought[shop] ??= {})[wide("item.", i, 16)] = 9;
    }
    for (let day = 1; day <= CAPS.ledgerStubs; day++) {
      for (let i = 0; i < 4; i++) P.log(core, "y".repeat(CAPS.ledgerChars + 40), day);
    }
    for (let day = CAPS.ledgerStubs + 1; day <= CAPS.ledgerStubs + CAPS.ledgerDays; day++) {
      for (let i = 0; i < CAPS.ledgerPerDay + 3; i++) P.log(core, "y".repeat(CAPS.ledgerChars + 40), day);
    }
    for (let i = 0; i < CAPS.found + 8; i++) P.discover(core, { p: wide("z", i, 4), e: i % 3, d: i % 5, day: 10 + i });
    P.setHome(core, zoneIds[3] ?? "z3");
    // …and the ENVELOPE at its realistic worst too: every zone bound (the maps
    // export binds every planned zone) and every one-shot intro flag burned.
    sim.intro = { world: true, zones: {}, npcs: {} };
    for (const zoneId of zoneIds) {
      sim.intro.zones[zoneId] = true;
      w.bindings[`pf.${zoneId}.anchor`] = zoneId;
      for (const npc of w.zones[zoneId].npcs ?? []) sim.intro.npcs[npc.name] = true;
    }
    sim.zoneId = zoneIds[0];
    sim.day = 999;
    sim.clockMin = 1_339;
    const block = JSON.stringify(P.serialize(sim.player));
    const snap = JSON.stringify(loadedPF.save.snapshot(core));
    return { block, snap, zones: zoneIds.length, parsed: JSON.parse(block) };
  };

  const town = saturate("town");
  // SATURATION IS THE PRECONDITION. A shape measured against a block that never
  // reached its caps measures nothing.
  const at = town.parsed;
  assert.equal(at.pouch.items.length, CAPS.items, "the pouch is at its cap");
  assert.equal(
    Object.values(at.rel).reduce((n, rows) => n + Object.keys(rows).length, 0),
    CAPS.relRows,
    "the relationship ledger is at its row cap",
  );
  assert.equal(
    Object.values(at.rel).reduce((n, rows) => n + Object.values(rows).filter((c) => c.s).length, 0),
    CAPS.relLines,
    "and at its line cap",
  );
  assert.equal(Object.keys(at.quests_done_board).length, CAPS.boardDone, "the board's counters are at their cap");
  assert.equal(Object.keys(at.quests.done_pack).length, CAPS.packDone, "and the pack's");
  assert.equal(at.quests.active.length, CAPS.activeQuests, "the active list is full");
  assert.equal(at.found.zones.length, CAPS.found, "discovery is at its cap");
  assert.equal(
    at.ledger.lines.length,
    CAPS.ledgerDays * CAPS.ledgerPerDay + CAPS.ledgerStubs,
    "and the ledger holds its full days plus its full run of stubs",
  );

  // …AT THE PLAN'S OWN NUMBERS, PINNED. Every assertion above reads CAPS, so it
  // would go on passing against caps shrunk to anything at all — and they were
  // shrunk once, to fit a size budget that has since been abolished (maintainer
  // ruling, round 2), which is what made settlements feel tiny. Pinned so a
  // size-motivated retune has to be an explicit decision rather than a quiet
  // one. These are gameplay bounds; the walls below are the size question.
  assert.deepEqual(
    {
      items: CAPS.items,
      relRows: CAPS.relRows,
      relLines: CAPS.relLines,
      lineChars: CAPS.lineChars,
      boardDone: CAPS.boardDone,
      packDone: CAPS.packDone,
      bought: CAPS.bought,
      ledgerPerDay: CAPS.ledgerPerDay,
      ledgerStubs: CAPS.ledgerStubs,
      ledgerChars: CAPS.ledgerChars,
      found: CAPS.found,
    },
    {
      items: 60,
      relRows: 150,
      relLines: 30,
      lineChars: 80,
      boardDone: 40,
      packDone: 40,
      bought: 30,
      ledgerPerDay: 15,
      ledgerStubs: 30,
      ledgerChars: 200,
      found: 80,
    },
    "the caps are the plan's own numbers, and a saturated block really reaches every one of them",
  );

  // THE ONE WALL EVERY WRITE IS SUBJECT TO. MAX_SNAPSHOT_CHARS mirrors the
  // Engine's per-row cap: past it the route 422s, the pre-flight refuses, and
  // the session degrades permanently. Asserted on the largest world the
  // compiler builds at all — a city compiles ~118 zones and ~147 residents, so
  // its ENVELOPE alone is ~7.5 KB before the player block exists.
  const SERVER_ROW_CAP = 262_144;
  const city = saturate("city");
  assert.ok(city.zones > 100, `the city fixture really is city-sized (${city.zones} zones)`);
  for (const [label, shape] of [
    ["town", town],
    ["city", city],
  ]) {
    assert.ok(
      shape.snap.length <= SERVER_ROW_CAP,
      `a saturated ${label} snapshot is ${shape.snap.length} chars, past the server's own row cap — saving would degrade permanently`,
    );
    // …with CLEAR margin, not merely under it. A saturated world sitting at 90%
    // of the wall would be one feature away from the permanent degrade, and the
    // point of measuring is to see that coming.
    assert.ok(
      shape.snap.length <= SERVER_ROW_CAP / 2,
      `a saturated ${label} snapshot is ${shape.snap.length} chars — over half the server row cap, which is too close to the wall`,
    );
  }

  // THE QUARANTINE TRIPWIRE IS NOT A WALL EITHER, and the max shape is how you
  // tell. Its ceiling exists to stop a pathological blob bloating the chat's
  // metadata, not to be an allowance the bag is squeezed into — so a REAL
  // severance of a fully-played world has to fit with every other slot beside it
  // and room to spare. At 24,576 it did not: a saturated block alone is bigger
  // than that, and the one thing the bag exists to hold was the first thing it
  // dropped.
  const Q = loadedPF.quarantine;
  Q.reset();
  Q.put("chat-maxshape", "stamp", {
    reason: "mint",
    stamps: { seed: 1, briefHash: 2, mintStamp: 3 },
    fields: { rel: at.rel, questsActive: at.quests.active, ledgerLines: at.ledger.lines },
  });
  Q.put("chat-maxshape", "setAside", { reason: "displaced", fromV: 9, block: at });
  Q.put("chat-maxshape", "migration", { reason: "throw", block: at });
  assert.deepEqual(
    Q.slots(),
    ["migration", "setAside", "stamp"],
    "a severance of a fully-played world, a displaced copy of it and a failed migration all fit the bag at once",
  );
  const bagChars = JSON.stringify(Q._bag).length;
  assert.ok(bagChars < Q.MAX_CHARS, `…with room left over (${bagChars} of ${Q.MAX_CHARS} chars used)`);
  Q.reset();

  // The measured numbers, recorded rather than merely bounded: when a cap moves,
  // this is the line that says by how much and in which direction. The keepalive
  // pair is reported alongside because it binds the TEARDOWN path only — case
  // (j) is where that path's behaviour over the quota is pinned.
  const pairBytes = (shape) => 2 * new TextEncoder().encode(shape.snap).length;
  loadedPF.save.reset();
  console.log(
    `  max shape — town: block ${town.block.length}, snapshot ${town.snap.length} ` +
      `· city: block ${city.block.length}, snapshot ${city.snap.length} ` +
      `(262,144 server row cap, ${SERVER_ROW_CAP - city.snap.length} spare) ` +
      `· teardown pair (pagehide only): town ${pairBytes(town)}, city ${pairBytes(city)} bytes vs the 57,000 keepalive quota`,
  );
}

// (ah2) …AND THE CAPS HOLD ON THE PATHS THAT DO NOT GO THROUGH A MUTATOR.
// Case (ah) saturates through the shipped mutators, and that is exactly why it
// missed this: restoration and the transplant put whole fields back BY
// ASSIGNMENT, so the only thing between a quarantine entry and a block at twice
// the row cap is _enforceCaps. It held by evicting STRANGER rows — and once a
// hostile row stopped counting as a stranger, a hostile-on-hostile restore left
// the pass with nothing it was willing to take and the cap simply did not hold.
// A cap a restore can walk through is not a cap.
{
  const P = loadedPF.player;
  const CAPS = P.CAPS;
  const rowsIn = (rel) => Object.values(rel).reduce((n, rows) => n + Object.keys(rows).length, 0);

  const live = P.defaultPlayer();
  live.rel = { zLive: {} };
  for (let i = 0; i < CAPS.relRows; i++) live.rel.zLive[`Live_person_number_${i}`] = { d: 0, t: 1, h: 1 };
  const parked = { zParked: {} };
  for (let i = 0; i < CAPS.relRows; i++) parked.zParked[`Parked_person_num_${i}`] = { d: 0, t: 1, h: 1 };
  const stamps = P.stampsFor(null, null);
  const restored = P.restoreStamped(live, { reason: "mint", stamps, fields: { rel: parked } }, null, null);
  assert.equal(
    rowsIn(restored.rel),
    CAPS.relRows,
    `a hostile-on-hostile restore left ${rowsIn(restored.rel)} rel rows against a cap of ${CAPS.relRows}`,
  );

  // …and the eviction still spends the cheapest rows first. The cap holding
  // unconditionally must not mean it holds ARBITRARILY: a row the player built
  // something with is never the first to go, it is only no longer exempt.
  const mixed = P.defaultPlayer();
  mixed.rel = { z: {} };
  mixed.rel.z.stranger_a = { d: 0, t: 1 };
  mixed.rel.z.stranger_b = { d: 0, t: 2 };
  mixed.rel.z.close_friend = { d: 3, t: 90 };
  mixed.rel.z.remembered = { d: 0, t: 5, s: "said a thing", a: 4 };
  for (let i = 0; i < CAPS.relRows; i++) {
    mixed.rel.z[`hostile_${String(i).padStart(3, "0")}`] = { d: 0, t: 10 + i, h: 1 };
  }
  P._enforceCaps(mixed, 0);
  const left = Object.keys(mixed.rel.z);
  assert.equal(left.length, CAPS.relRows, "the count lands exactly on the cap");
  assert.ok(!left.includes("stranger_a") && !left.includes("stranger_b"), "both pure strangers went first");
  assert.ok(left.includes("close_friend"), "the row at the top of the ladder survived");
  assert.ok(left.includes("remembered"), "so did the row with a remembered line");
  assert.ok(!left.includes("hostile_000") && !left.includes("hostile_001"), "the two least-encountered hostiles went");
  assert.ok(left.includes(`hostile_${String(CAPS.relRows - 1).padStart(3, "0")}`), "the most-encountered one stayed");
}

// (ai) THE PLAYER BLOCK KEEPS A NEWER BUILD'S KEYS TOO.
// The envelope has had unknown-key retention since slice 1; the block did not,
// and serialize() rebuilds `out` from a fixed key list, so a field a newer build
// added at the SAME player.v was dropped on read and deleted by the next flush.
// The block's version gate does not cover it: the gate only fires when `v`
// moves, and bumping `v` for one additive field costs every older build a
// defaults boot until re-adoption. ROADMAP §S5 promises both mechanisms for the
// block by name ("unknown keys preserved rather than dropped so a downgrade does
// not silently destroy data a newer build wrote"), and plan §Q1 says
// "unknown-key retention both levels".
{
  const P = loadedPF.player;
  const fromNewer = {
    ...P.serialize(P.defaultPlayer()),
    pouch: { money: 12, items: [] },
    reputation: 42,
    pets: [{ n: "cat" }],
  };
  const parsed = P.parse(JSON.parse(JSON.stringify(fromNewer)));
  assert.equal(parsed.source, "saved", "the block is readable — same v, one extra field");
  assert.equal(parsed.player.pouch.money, 12, "so this is a real parse, not a defaults boot");
  assert.equal(parsed.player.reputation, 42, "and the newer build's field is retained, not deleted");
  assert.deepEqual(parsed.player.pets, [{ n: "cat" }], "by value, like the envelope's carry");

  const wire = JSON.stringify(P.serialize(parsed.player));
  assert.ok(wire.startsWith('{"pets":'), "re-emitted FIRST and sorted, so the bytes cannot drift with the source");
  assert.equal(JSON.stringify(P.serialize(P.parse(JSON.parse(wire)).player)), wire, "and a round trip changes nothing");

  const sim = new loadedPF.Sim(world.build(11, "cozy-village"));
  sim.player = parsed.player;
  const snap = loadedPF.save.snapshot({ sim, chatId: "chat-blockcarry" });
  assert.equal(snap.player.reputation, 42, "it survives the flush the older build makes");

  // dropCarry is the pre-flight's escape hatch and it has to REACH the block:
  // a foreign field living only inside `player` is otherwise unshakeable.
  const slim = loadedPF.save.snapshot({ sim, chatId: "chat-blockcarry" }, true);
  assert.equal(slim.player.reputation, undefined, "the slim snapshot sheds the block's carry too");
  assert.equal(slim.player.pouch.money, 12, "while this world's own state stays");
  const shed = loadedPF.save._snapshotWithoutCarry(sim, "chat-blockcarry");
  assert.ok(shed, "and _snapshotWithoutCarry offers the shed even with no ENVELOPE carry at all");

  // …and a block with nothing foreign in it gains no bytes for the mechanism.
  assert.equal(
    JSON.stringify(P.serialize(P.defaultPlayer())),
    JSON.stringify(P.serialize(P.defaultPlayer(), true)),
    "no carry, no bytes",
  );
}

// (aj) THE STAMP SLOT MERGES, setAside IS A LIST, AND OVERFLOW REFUSES WHAT IT
// CANNOT HOLD. The stamp slot was one-shot like the others, and that was a
// data-loss bug with a lie on top: applyStamps STRIPS the live block before
// offering the entry, so a second severance found the slot full, was told
// `false`, and deleted everything it had just stripped — while still telling the
// player it had been set aside.
{
  const Q = loadedPF.quarantine;
  Q.reset();
  const stamps = { seed: 1, briefHash: 2, mintStamp: 3 };
  assert.equal(
    Q.put("chat-merge", "stamp", {
      reason: "brief",
      fromV: 1,
      stamps,
      fields: {
        rel: { z1: { Ann: { d: 1, t: 2 } } },
        questsActive: [{ id: "q1", have: 1 }],
        ledgerLines: [[1, "one"]],
        found: [{ p: "z1", e: 0, d: 0, day: 1 }],
        home: "z3",
      },
    }),
    true,
  );
  assert.equal(
    Q.put("chat-merge", "stamp", {
      reason: "brief",
      fromV: 1,
      stamps,
      fields: {
        rel: { z1: { Ann: { d: 3, t: 9 }, Bo: { d: 0, t: 1 } } },
        questsActive: [
          { id: "q1", have: 5 },
          { id: "q2", have: 0 },
        ],
        ledgerLines: [[2, "two"]],
        found: [{ p: "z2", e: 0, d: 0, day: 2 }],
        home: "z9",
      },
    }),
    true,
    "a SECOND severance is taken, not refused — first-loss-wins here was deletion",
  );
  const held = Q.peek("stamp");
  assert.equal(held.fields.rel.z1.Ann.d, 3, "a person both severances knew keeps the higher-tier cell");
  assert.ok(held.fields.rel.z1.Bo, "and a person only the second knew is kept as well");
  assert.deepEqual(
    held.fields.questsActive.map((q) => q.id).sort(),
    ["q1", "q2"],
    "quests concatenate and dedupe by id",
  );
  assert.equal(held.fields.questsActive.find((q) => q.id === "q1").have, 5, "keeping the one that got further");
  assert.deepEqual(
    held.fields.ledgerLines,
    [
      [1, "one"],
      [2, "two"],
    ],
    "ledger lines concatenate in order",
  );
  assert.equal(held.fields.found.length, 2, "discoveries union by their composite key");
  assert.equal(held.fields.home, "z3", "and the HELD home stands — two homes are not a home");

  // A severance of a DIFFERENT kind still unions its fields, but the FIRST loss
  // stays the anchor: its stamps are what a returning world is matched against.
  assert.equal(
    Q.put("chat-merge", "stamp", {
      reason: "mint",
      fromV: 1,
      stamps: { seed: 9, briefHash: 9, mintStamp: 9 },
      fields: { found: [{ p: "z7", e: 0, d: 0, day: 7 }] },
    }),
    true,
  );
  const after = Q.peek("stamp");
  assert.equal(after.reason, "brief", "the older entry's reason survives");
  assert.deepEqual(after.stamps, stamps, "and its stamps — the first loss is the anchor");
  assert.equal(after.fields.found.length, 3, "while the newcomer's fields still union in");

  // …AND AN EXACT (d,t) TIE LEAVES THE HELD ROW STANDING. The rule is "the higher
  // `d` wins, then more encounters, then the held row", and the held entry is the
  // merge's anchor everywhere else — its stamps, its reason, its `at`, its home.
  // It was not true of `rel`: the loop offered the INCOMING row first and
  // replaced only on a strict improvement, so two rows tying on both ranks left
  // the incoming one in the slot and the held row's remembered line was what went.
  // Cleared with `discard` rather than `reset()` so the whole case stays ONE
  // queued write on the shared chain — (ak) counts what the chain carries.
  Q.discard("chat-merge", "stamp");
  Q.put("chat-merge", "stamp", {
    reason: "brief",
    fromV: 1,
    stamps,
    fields: { rel: { z1: { Cass: { d: 2, t: 4, s: "She showed you the ford.", a: 3 } } } },
  });
  Q.put("chat-merge", "stamp", {
    reason: "brief",
    fromV: 1,
    stamps,
    fields: { rel: { z1: { Cass: { d: 2, t: 4, s: "A stranger with the same name." } } } },
  });
  const tied = Q.peek("stamp").fields.rel.z1.Cass;
  assert.equal(tied.s, "She showed you the ford.", "an exact (d,t) tie leaves the HELD row standing");
  assert.equal(tied.a, 3, "…whole, the way every other anchored field of the merge is kept");
  // The tiebreak is only reached ON a tie: more encounters at the same tier is a
  // rank, and a rank the held row does not get to override.
  Q.put("chat-merge", "stamp", {
    reason: "brief",
    fromV: 1,
    stamps,
    fields: { rel: { z1: { Cass: { d: 2, t: 5, s: "One more meeting." } } } },
  });
  assert.equal(Q.peek("stamp").fields.rel.z1.Cass.t, 5, "more encounters at the same tier still takes the row");

  // A ZONE NAMED FOR SOMETHING ON Object.prototype. The merge read `merged[zoneId]`
  // bare, so "constructor" resolved to the INHERITED function, came back truthy, and
  // was adopted as the bucket: that zone's rows were written onto `Object` itself and
  // the merged map never grew an own key to hand back. `ownEntries` already refuses
  // "__proto__", so the inherited NAMES are the half that was left — and a zone id is
  // whatever the generated brief called a place.
  Q.discard("chat-merge", "stamp");
  Q.put("chat-merge", "stamp", {
    reason: "brief",
    fromV: 1,
    stamps,
    fields: { rel: { constructor: { Dov: { d: 1, t: 1 } } } },
  });
  Q.put("chat-merge", "stamp", {
    reason: "brief",
    fromV: 1,
    stamps,
    fields: { rel: { constructor: { Dov: { d: 4, t: 2 } }, toString: { Eda: { d: 1, t: 1 } } } },
  });
  const shadowed = Q.peek("stamp").fields.rel;
  assert.deepEqual(
    Object.keys(shadowed).sort(),
    ["constructor", "toString"],
    "a zone named for an inherited member is an OWN key of the merged map",
  );
  assert.equal(shadowed.constructor.Dov.d, 4, "…and its rows merge by the rule every other zone gets");
  assert.equal(shadowed.toString.Eda.d, 1, "…including a zone only the second severance knew");
  assert.ok(
    !Object.prototype.hasOwnProperty.call(Object, "Dov") &&
      !Object.prototype.hasOwnProperty.call(Object.prototype.toString, "Eda"),
    "and nothing was written onto the builtin the bare read would have handed back",
  );

  // setAside is the one HUMAN-resolved slot, so it is the one LIST.
  Q.reset();
  Q.put("chat-aside", "setAside", { reason: "displaced", fromV: 1, block: { tag: "first" } });
  Q.put("chat-aside", "setAside", { reason: "displaced", fromV: 2, block: { tag: "second" } });
  assert.equal(Q.peekAll("setAside").length, 2, "a second displaced live block is a second thing to offer the player");
  assert.equal(Q.peek("setAside").block.tag, "first", "peek() hands back the oldest, which is what one caller means");
  // Read on a DIFFERENT chat, because this line is about hydrate's tolerance for
  // the pre-list wire SHAPE and nothing else. Reading it on the chat two parks
  // are still queued for asks a second question — whether a disk read outranks an
  // unsettled write of our own — and the answer to that one is (ak2)'s: it does
  // not, and it must not, or a park is lost to a chat round trip.
  Q.hydrate({ pixelforgeQuarantine: { setAside: { reason: "displaced", block: { tag: "legacy" } } } }, "chat-legacy");
  assert.equal(Q.peekAll("setAside").length, 1, "a key written before the list shape reads as its one entry");
  assert.equal(Q.peek("setAside").block.tag, "legacy", "…verbatim");

  // AND `consume` IS `peek` THAT ALSO TAKES. It was not: for the one slot that
  // is a list it handed back the LIST WRAPPER while peek handed back an entry,
  // so the two readers of the one human-resolved slot disagreed about what they
  // were returning. Slice 6's resolution UI is the first live caller and would
  // have found it the hard way.
  Q.reset();
  Q.put("chat-consume", "setAside", { reason: "displaced", fromV: 1, block: { tag: "first" } });
  Q.put("chat-consume", "setAside", { reason: "displaced", fromV: 2, block: { tag: "second" } });
  const took = Q.consume("chat-consume", "setAside");
  assert.equal(took.block.tag, "first", "consume() returns the same entry peek() would have");
  assert.equal(Q.peekAll("setAside").length, 1, "…and takes only that one, leaving the rest held");
  assert.equal(Q.peek("setAside").block.tag, "second", "the next caller gets the next one");
  const rest = Q.consumeAll("chat-consume", "setAside");
  assert.deepEqual(
    rest.map((e) => e.block.tag),
    ["second"],
    "consumeAll() is the bulk verb, and it mirrors peekAll()",
  );
  assert.deepEqual(Q.slots(), [], "an emptied list takes its slot with it");
  assert.equal(Q.consume("chat-consume", "setAside"), null, "consuming an empty slot is null, not an empty wrapper");
  Q.put("chat-consume", "migration", { reason: "throw", block: { tag: "single" } });
  assert.deepEqual(
    Q.consumeAll("chat-consume", "migration").map((e) => e.block.tag),
    ["single"],
    "…and a single-entry slot consumes all as a one-element list",
  );

  // OVERFLOW: an entry that cannot be held even on its own is refused OUTRIGHT.
  // The old loop worked down the drop order, spent every other slot making room
  // it could never use, and dropped the oversized entry too — while `put` had
  // already returned true.
  Q.reset();
  Q.put("chat-fit", "migration", { reason: "throw", block: { blob: "m".repeat(5_000) } });
  Q.put("chat-fit", "version", { adoptable: true, fromV: 9, block: { blob: "v".repeat(5_000) } });
  const before = Q.slots();
  assert.equal(
    Q.put("chat-fit", "stamp", { reason: "brief", stamps: {}, fields: { blob: "x".repeat(Q.MAX_CHARS + 5_000) } }),
    false,
    "an entry larger than the whole bag is refused",
  );
  assert.deepEqual(Q.slots(), before, "and refusing it costs the slots that could still be held nothing");
  Q.reset();
}

// (ak) THE BAG HAS ONE WRITER.
// Every bag write was `void this._write(...)` with its own retry loop, and the
// version re-adoption fires three in one synchronous stretch. Nothing ordered
// them, and `_write` froze its payload at entry — so a retried write could land
// LAST carrying a snapshot of the bag from before a consume() and resurrect the
// slot the consume had just cleared.
await withSavePath(async ({ calls, armed, behavior, tick }) => {
  const Q = loadedPF.quarantine;
  const bagWrites = () => calls.filter((c) => c.kind === "patch" && "pixelforgeQuarantine" in c.patch);
  // Drain whatever the previous case left on the shared chain before counting:
  // it is a module singleton and the chain deliberately outlives reset().
  await tick();

  Q.reset();
  calls.length = 0;
  Q.put("chat-chain", "migration", { reason: "throw", block: { a: 1 } });
  Q.put("chat-chain", "version", { adoptable: true, fromV: 9, block: { b: 2 } });
  Q.consume("chat-chain", "version");
  await tick();
  assert.equal(bagWrites().length, 1, "three bag mutations in one tick collapse to ONE write");
  assert.deepEqual(
    Object.keys(bagWrites()[0].patch.pixelforgeQuarantine),
    ["migration"],
    "and that write carries the LAST bag state, not the first",
  );

  // THE RETRY. It must re-read the bag, not replay the snapshot it was queued
  // with — that is the exact path by which an invalidated slot came back.
  Q.reset();
  calls.length = 0;
  armed.length = 0;
  let attempts = 0;
  behavior.patch = async () => {
    attempts += 1;
    if (attempts === 1) throw Object.assign(new Error("bad minute"), { status: 503 });
  };
  Q.put("chat-retry", "stamp", { reason: "brief", stamps: { seed: 1 }, fields: { rel: {} } });
  await tick();
  assert.equal(attempts, 1, "the first attempt went out and failed");
  Q.consume("chat-retry", "stamp"); // the slot is invalidated while the retry sleeps
  const sleep = armed.find((t) => t.ms === 500);
  assert.ok(sleep, "…and the retry is parked on its backoff");
  sleep.fn();
  await tick();
  const wrote = bagWrites();
  assert.equal(wrote[0].patch.pixelforgeQuarantine.stamp.reason, "brief", "the first attempt carried the entry");
  assert.ok(wrote.length > 1, "and the retry went out behind it");
  assert.ok(
    wrote.slice(1).every((c) => c.patch.pixelforgeQuarantine === null),
    "…carrying the bag AS IT STANDS — no write after the consume resurrects the slot it cleared",
  );
  Q.reset();

  // THE CHAT SWITCH, which is where the single writer's own bookkeeping bit it.
  // The queued task read its payload out of a FIELD at run time, and reset()
  // has to clear that field or the departing chat's task writes the arriving
  // chat's bytes. So the task ran, found null, and _writeNow's empty-text guard
  // dropped it: the severance parked at the very moment of leaving a chat never
  // reached that chat's disk. The payload is bound to the task now.
  calls.length = 0;
  behavior.patch = async () => {};
  await tick();
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  let inFlight = 0;
  behavior.patch = async () => {
    inFlight += 1;
    if (inFlight === 1) await gate;
  };
  Q.reset();
  Q.hydrate({}, "chat-leaving");
  Q.put("chat-leaving", "migration", { reason: "throw", block: { a: 1 } });
  await tick(); // write #1 is parked inside patchMetadata
  Q.put("chat-leaving", "stamp", { reason: "mint", stamps: { seed: 1 }, fields: { home: "parked-on-the-way-out" } });
  // …and NOW the chat switches, with that second write still queued behind #1.
  Q.reset();
  Q.hydrate({}, "chat-arriving");
  release();
  await tick();
  const landed = bagWrites();
  assert.ok(
    landed.every((c) => c.chatId === "chat-leaving"),
    "the departing chat's queued write is the only thing on the wire",
  );
  const parked = landed.filter((c) => c.patch.pixelforgeQuarantine?.stamp);
  assert.equal(parked.length, 1, "the park queued at the moment of leaving REACHED THE WIRE");
  assert.equal(
    parked[0].patch.pixelforgeQuarantine.stamp.fields.home,
    "parked-on-the-way-out",
    "…carrying the bytes it was asked for, not the arriving chat's",
  );
  assert.deepEqual(
    landed.map((c) => Object.keys(c.patch.pixelforgeQuarantine ?? {}).sort()),
    [["migration"], ["migration", "stamp"]],
    "and both writes landed for that chat, in the order they were asked for",
  );
  behavior.patch = async () => {};
  Q.reset();
});

// (ak2) …AND A PARK SURVIVES A ROUND TRIP THROUGH ANOTHER CHAT.
// The holder fixed the ONE-WAY trip: leave a chat and its queued write still
// carries that chat's bytes. It does not fix the ROUND trip, and the round trip
// is the one a player actually makes. Park something on A, glance at B, come back
// to A before the chain has drained: hydrate() rebuilds A's bag from DISK — which
// does not have the park, because the write never landed — and sets the dedupe
// cache to those same bytes. The queued task then wakes, finds itself "live" on
// A, re-serializes the disk bag it now sees, matches the cache, and drops the
// write. The park is gone from disk AND from memory, on the one path most likely
// to have produced a park in the first place.
await withSavePath(async ({ calls, behavior, tick }) => {
  const Q = loadedPF.quarantine;
  const bagWrites = () => calls.filter((c) => c.kind === "patch" && "pixelforgeQuarantine" in c.patch);
  await tick(); // drain whatever the previous case left on the shared chain
  Q.reset();
  Q._unsettled.clear();
  calls.length = 0;
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  let inFlight = 0;
  behavior.patch = async () => {
    inFlight += 1;
    if (inFlight === 1) await gate;
  };

  Q.hydrate({}, "chat-round-a");
  Q.put("chat-round-a", "migration", { reason: "throw", block: { a: 1 } });
  await tick(); // write #1 is parked inside patchMetadata
  Q.put("chat-round-a", "stamp", { reason: "mint", stamps: { seed: 1 }, fields: { home: "parked-then-left" } });

  // Away…
  loadedPF.save.reset();
  Q.hydrate({}, "chat-round-b");
  assert.deepEqual(Q.slots(), [], "B's bag is B's");

  // …and BACK, before the chain has drained. The metadata the host hands over is
  // what actually reached disk, which is write #1 and nothing more.
  loadedPF.save.reset();
  Q.hydrate({ pixelforgeQuarantine: { migration: { reason: "throw", block: { a: 1 } } } }, "chat-round-a");
  assert.deepEqual(
    Q.slots(),
    ["migration", "stamp"],
    "coming back does not demote the bag to whatever disk managed to store",
  );
  assert.ok(Q.peek("stamp"), "the park is still held in memory, which is where the authority lives");

  release();
  await tick();
  const withStamp = bagWrites().filter((c) => c.patch.pixelforgeQuarantine?.stamp);
  assert.equal(withStamp.length, 1, "and the write carrying it REACHED THE WIRE");
  assert.equal(withStamp[0].chatId, "chat-round-a", "for the chat it belongs to");
  assert.equal(withStamp[0].patch.pixelforgeQuarantine.stamp.fields.home, "parked-then-left", "carrying its own bytes");
  assert.deepEqual(Q.slots(), ["migration", "stamp"], "and the bag still holds both afterwards");
  assert.equal(Q._unsettled.has("chat-round-a"), false, "…while the record of the unsettled write settles, not leaks");

  behavior.patch = async () => {};
  Q.reset();
  Q._unsettled.clear();
});

// (ak3) …AND A WRITE THAT FAILED OUT IS ACTUALLY RE-TRIED ON THE NEXT VISIT.
// `_unsettled` is documented as "deliberately NOT cleared when a write fails out:
// an entry nobody managed to store is precisely the one worth re-trying on the
// next visit". Adopting the bytes at hydrate restored them to MEMORY only, and
// nothing asked for the wire again — so a park whose write failed sat in the map
// for the rest of the session and died with the tab, which is the same loss the
// map exists to prevent, one step later.
await withSavePath(async ({ calls, armed, behavior, tick }) => {
  const Q = loadedPF.quarantine;
  const bagWrites = () => calls.filter((c) => c.kind === "patch" && "pixelforgeQuarantine" in c.patch);
  await tick(); // drain the shared chain
  Q.reset();
  Q._unsettled.clear();
  calls.length = 0;
  armed.length = 0;
  behavior.patch = async () => {
    throw Object.assign(new Error("storage is down"), { status: 503 });
  };
  Q.hydrate({}, "chat-lost");
  Q.put("chat-lost", "stamp", { reason: "brief", stamps: { seed: 7 }, fields: { home: "parked-and-unstored" } });
  // Three attempts, two backoffs, all of them failing.
  for (let i = 0; i < 4; i++) {
    await tick();
    const sleep = armed.find((t) => (t.ms === 500 || t.ms === 1000) && !t.fired);
    if (!sleep) break;
    sleep.fired = true;
    sleep.fn();
  }
  await tick();
  assert.ok(bagWrites().length >= 1, "the write did go out");
  assert.equal(Q._unsettled.has("chat-lost"), true, "and failing out leaves the record standing, as documented");

  // Away, and back — with storage working again. The metadata the host hands over
  // is what actually reached disk, which is nothing.
  behavior.patch = async () => {};
  loadedPF.save.reset();
  Q.hydrate({}, "chat-elsewhere");
  loadedPF.save.reset();
  calls.length = 0;
  Q.hydrate({}, "chat-lost");
  assert.ok(Q.peek("stamp"), "the return visit adopts the entry the write never stored");
  await tick();
  const relanded = bagWrites().filter((c) => c.patch.pixelforgeQuarantine?.stamp);
  assert.equal(relanded.length, 1, "AND ASKS FOR THE WIRE AGAIN — the retry the docstring promised is a real retry");
  assert.equal(relanded[0].chatId, "chat-lost", "for the chat that owed it");
  assert.equal(
    relanded[0].patch.pixelforgeQuarantine.stamp.fields.home,
    "parked-and-unstored",
    "carrying the bytes that were lost",
  );
  assert.equal(Q._unsettled.has("chat-lost"), false, "…and this time it settles");

  // …and a revisit that owes disk NOTHING costs no write at all: the comparison
  // is against what disk holds, so re-entering a chat is not a write of its own.
  loadedPF.save.reset();
  calls.length = 0;
  Q.hydrate({ pixelforgeQuarantine: { stamp: { reason: "brief", stamps: { seed: 7 } } } }, "chat-lost");
  await tick();
  assert.equal(bagWrites().length, 0, "a chat whose bag disk already holds is re-entered silently");

  // ── AND THE LEAK GUARD DOES NOT EAT THE THING IT GUARDS ──
  // Every entry in this map is a write NOT known to have reached disk, so the old
  // drop-the-oldest ceiling silently re-opened the park loss for whichever chat
  // was furthest back. The one droppable kind is an entry disk is known to hold —
  // `_writeNow` returns early when the live chat's bytes match the dedupe cache
  // and leaves its record standing — and past THAT the map carries the overflow
  // rather than the loss.
  //
  // DELIBERATELY THE SAME TRADE PF.save._cacheBrief MAKES (O-2). Two caches
  // written in the same commit chose opposite policies at the same fork: the
  // brief cache refuses to evict an entry that is still the only witness, while
  // this one force-evicted and warned. They are the same shape of thing — a
  // per-session map of small byte strings, each entry the sole record of
  // something a later visit needs — so they now answer the fork the same way. A
  // ceiling that can only be met by throwing away the thing the map exists to
  // hold is not a ceiling worth meeting.
  Q.reset();
  Q._unsettled.clear();
  calls.length = 0;
  Q._chatId = "chat-live";
  Q._bag = { migration: { reason: "throw", block: { a: 1 } } };
  Q._bagSerialized = JSON.stringify(Q._bag);
  // Recorded LAST on purpose: under a plain drop-the-oldest ceiling this is the
  // entry that survives and an unstored write is the one that goes, which is the
  // whole inversion. Preference, not position, decides.
  for (let i = 0; i < 7; i++) {
    Q._unsettled.set(`chat-owed-${i}`, JSON.stringify({ stamp: { reason: "brief", n: i } }));
  }
  Q._unsettled.set("chat-live", Q._bagSerialized); // disk holds these; the record is stale
  const warned = [];
  const realWarn = console.warn;
  console.warn = (...args) => warned.push(args.map(String).join(" "));
  try {
    Q._write("chat-ninth"); // nine entries against a ceiling of eight
    assert.equal(Q._unsettled.has("chat-live"), false, "the entry disk is known to hold is the one that goes");
    assert.deepEqual(warned, [], "…silently, because nothing was lost");
    for (let i = 0; i < 7; i++) {
      assert.ok(Q._unsettled.has(`chat-owed-${i}`), `and no unstored write was touched (chat-owed-${i})`);
    }
    Q._write("chat-tenth"); // now the ceiling could only be met by a real loss
    assert.equal(Q._unsettled.size, 9, "so it is not met — the map carries the overflow instead");
    for (let i = 0; i < 7; i++) {
      assert.ok(Q._unsettled.has(`chat-owed-${i}`), `and still no unstored write went (chat-owed-${i})`);
    }
    assert.deepEqual(warned, [], "…with nothing to announce, because nothing was lost");
  } finally {
    console.warn = realWarn;
  }
  await tick();
  behavior.patch = async () => {};
  Q.reset();
  Q._unsettled.clear();
});

// (al) THE INTERIM WORLD LEAVES A MARK.
// A chat created before the loading gate boots on a throwaway world. If it
// flushes there, the block's stamps are all zero — which is also exactly what a
// pre-S5 save looks like, and the pre-S5 branch adopts WHOLESALE. So a player
// who closed the tab before the brief sealed came back to a compiled world that
// had inherited relationships with people who never existed in it.
await withSavePath(async ({ tick }) => {
  const P = loadedPF.player;
  const meta = { gameSetupConfig: { experienceConfig: { generate: true, seed: 777, theme: "cozy-village" } } };
  const sim = loadedPF.save.simFromSaved(null, meta, "chat-interim");
  assert.equal(sim.world.interim, true, "a generation-enabled chat with no sealed brief boots a throwaway");
  const core = { chatId: "chat-interim", sim, hud: { toast() {}, refreshChips() {} } };
  P.grant(core, "apple", 2);
  P.bump(core, sim.zoneId, "Someone Who Never Was", { d: 2, t: 4 });
  const row = JSON.parse(JSON.stringify(loadedPF.save.snapshot(core)));
  assert.equal(row.player.world.interim, 1, "and a save flushed while standing in it says so on the wire");
  assert.equal(row.player.world.seed, sim.world.seed >>> 0, "carrying the throwaway's seed, and no other stamp");

  const sealed = brief.validate(
    {
      scale: "village",
      name: "Sealedbrook",
      backgroundPopulation: 20,
      situation: "The mill wheel has not turned since the spring flood.",
      cast: [{ name: "Wren Ash", role: "miller", kind: "maker", tint: "amber", home: "Sealedbrook", household: 1 }],
    },
    { theme: "cozy-village", seed: 777 },
  );
  loadedPF.save.reset();
  const sim2 = loadedPF.save.simFromSaved(row, { ...meta, pixelforgeBrief: sealed }, "chat-interim");
  assert.equal(sim2.player.pouch.items.length, 1, "the world-FREE half crosses into the compiled world");
  assert.deepEqual(sim2.player.rel, {}, "the world-BOUND half does not — it belonged to a world that never was");
  const parked = loadedPF.quarantine.peek("stamp");
  assert.ok(parked, "it is quarantined instead of adopted wholesale");
  assert.ok(parked.fields.rel[Object.keys(parked.fields.rel)[0]], "with the rows it stripped");
  assert.equal(sim2.player.world.interim, undefined, "and the mark clears once the block has a real world");
  assert.equal(sim2.player.world.briefHash, P.briefHashOf(sealed), "which it is now stamped for");
  await tick();
  loadedPF.save.reset();
});

// (am) RESTORATION RE-ENTERS THROUGH THE INVARIANTS, AND `bought` IS WORLD-BOUND.
// Restoration and the transplant are the two paths that put whole fields back by
// ASSIGNMENT, without a mutator. Every cap and every dedupe the mutators enforce
// has to be re-run there or the block lands at twice the row cap with two copies
// of one quest id in it.
{
  const P = loadedPF.player;
  const w = world.build(2024, "cozy-village");
  const core = { chatId: "chat-restore", sim: new loadedPF.Sim(w), hud: { toast() {}, refreshChips() {} } };
  const stamps = P.stampsFor(w, null);
  for (let i = 0; i < P.CAPS.relRows; i++) P.bump(core, "village", `Live ${i}`, { d: 2, t: 3 });
  P.quest(core, "accept", { id: "q1", g: "z1|Someone", verb: "fishing", target: "fish", n: 5 });
  P.quest(core, "progress", { id: "q1", by: 4 });
  const parkedRel = { village: {} };
  for (let i = 0; i < P.CAPS.relRows; i++) parkedRel.village[`Parked ${i}`] = { d: 0, t: 1 };
  const parkedQuests = [{ id: "q1", g: "z1|Someone", verb: "fishing", target: "fish", n: 5, have: 1, day: 1 }];
  for (let i = 0; i < P.CAPS.activeQuests + 5; i++) {
    parkedQuests.push({ id: `p${i}`, g: "z1|Someone", verb: "fishing", target: "fish", n: 5, have: 2, day: 1 });
  }
  const restored = P.restoreStamped(
    core.sim.player,
    { reason: "mint", fromV: 1, stamps, fields: { rel: parkedRel, questsActive: parkedQuests } },
    w,
    null,
  );
  assert.ok(restored, "the stamps match, so this is a save coming home");
  const rows = Object.values(restored.rel).reduce((n, r) => n + Object.keys(r).length, 0);
  assert.ok(rows <= P.CAPS.relRows, `the restored block honours the row cap (${rows} rows)`);
  assert.equal(restored.quests.active.filter((q) => q.id === "q1").length, 1, "one row per quest id");
  assert.equal(restored.quests.active.find((q) => q.id === "q1").have, 4, "and the LIVE row wins — it is being played");
  assert.ok(restored.quests.active.length <= P.CAPS.activeQuests, "the active cap holds after the merge");

  // `bought` counts what a NAMED shop's stock has lost, and both the shop and
  // its stock table are compiled from the brief (plan §2 puts it under the
  // world-bound banner). Carried across a brief change it depletes a stranger's
  // shelves; the code treated it as world-free everywhere.
  const player = P.defaultPlayer();
  player.world = { seed: 5, briefHash: 0, mintStamp: 222 };
  player.bought = { shop1: { rope: 2 } };
  player.rel = { z1: { Ann: { d: 1, t: 1 } } };
  const applied = P.applyStamps(player, { seed: 6, mintStamp: 222, zones: {} }, null, false);
  assert.ok(applied.severed, "a moved seed is a brief change");
  assert.equal(player.bought, null, "`bought` is severed with the rest of the world-bound set");
  assert.deepEqual(applied.severed.entry.fields.bought, { shop1: { rope: 2 } }, "and parked, not dropped");
  const home = P.restoreStamped(player, applied.severed.entry, { seed: 5, mintStamp: 222, zones: {} }, null);
  assert.deepEqual(home.bought, { shop1: { rope: 2 } }, "and it comes home with them");

  const source = P.defaultPlayer();
  source.bought = { shop1: { rope: 2 } };
  const moved = P.transplant(source, { seed: 7, mintStamp: 8, zones: {} }, null);
  assert.equal(moved.player.bought, null, "the brief-arrival transplant does not carry it across either");
  assert.deepEqual(
    moved.severed.entry.fields.bought,
    { shop1: { rope: 2 } },
    "it goes to the stamp slot with the rest",
  );
}

// (an) THE MUTATORS' SMALL HONESTIES.
// Six findings that all rhyme: a call that mutates and then refuses, an "oldest"
// that is really "alphabetically first", a guard three siblings have and one
// does not, and a stub that forgets what it stood for.
await withSavePath(async ({ makeCore }) => {
  const P = loadedPF.player;

  // VALIDATE BEFORE ALLOCATING. Both of these used to leave litter in the saved
  // block behind a call that reported doing nothing.
  const core = makeCore("chat-honest", 3131);
  assert.equal(P.equip(core, "fishing", "tool", { k: "fine" }), false, "an item with no type is refused");
  assert.equal(core.sim.player.skills.equipped.fishing, undefined, "and leaves no empty bucket behind");
  assert.equal(core.sim.dirty, false, "and does not dirty the sim over a mutation that did not happen");

  const capped = makeCore("chat-relcap", 3232);
  for (let i = 0; i < P.CAPS.relRows; i++) P.bump(capped, "village", `Built ${i}`, { d: 2, t: 2 });
  assert.equal(P.bump(capped, "elsewhere", "One Too Many", { d: 1 }), null, "the row cap refuses when nothing can go");
  assert.equal(capped.sim.player.rel.elsewhere, undefined, "…without minting the zone bucket on the way out");

  // AN ENEMY IS SOMETHING BUILT. `d === 0` was the whole stranger test, so the
  // one person the player made hostile was evictable and silently forgiven.
  const hostile = makeCore("chat-hostile", 3333);
  P.bump(hostile, "village", "Sworn Enemy", { d: 0, t: 1, h: true });
  for (let i = 0; i < P.CAPS.relRows - 1; i++) P.bump(hostile, "village", `Stranger ${i}`, { d: 0, t: 9 });
  P.bump(hostile, "village", "The Newcomer", { d: 0, t: 1 });
  assert.ok(hostile.sim.player.rel.village["Sworn Enemy"], "the hostile row survives the cap's eviction");

  // PROTOTYPE GUARDS AT EVERY MAP-WRITE SITE, not three of the four. A
  // "__proto__" key assigned onto a plain object repoints its PROTOTYPE.
  const hostileKeys = makeCore("chat-proto", 3434);
  const p = hostileKeys.sim.player;
  assert.equal(P.bump(hostileKeys, "__proto__", "Ann", { d: 1 }), null, "bump refuses a __proto__ ZONE");
  assert.equal(Object.getPrototypeOf(p.rel), Object.prototype, "…and p.rel is still an ordinary object");
  assert.equal(P.equip(hostileKeys, "__proto__", "tool", { t: "rod" }), false, "equip refuses a __proto__ verb");
  assert.equal(Object.getPrototypeOf(p.skills.equipped), Object.prototype, "…and equipped is untouched");
  P.award(hostileKeys, { xp: 50, verb: "__proto__" });
  assert.equal(Object.getPrototypeOf(p.skills.verbs), Object.prototype, "…and award does not repoint verbs either");
  assert.equal(p.skills.verbs.__proto__ === Object.prototype, true, "nothing was written at that key at all");
  // …and the READ hazard, which is the other half: `map.constructor` is a
  // function, so a bare read hands back a bucket that was never there.
  P.award(hostileKeys, { xp: 50, verb: "constructor" });
  assert.equal(typeof P.serialize(p).skills.verbs.constructor, "object", "a verb named `constructor` is a real row");

  // THE HEADER'S OWN CLAIM, PINNED. It said every cap was "an EVICTION, never a
  // refusal"; three of them refuse, and a consumer in slice 6 that believed the
  // header would read a 0 or a false as success.
  const refusing = makeCore("chat-refusals", 3838);
  for (let i = 0; i < P.CAPS.items; i++) P.grant(refusing, { t: `item${i}`, k: "" }, 1);
  assert.equal(P.grant(refusing, { t: "one too many", k: "" }, 1), 0, "`items` REFUSES a new pouch row at the cap");
  assert.equal(P.grant(refusing, { t: "item0", k: "" }, 1), 2, "…while a row already in the pouch still merges");
  for (let i = 0; i < P.CAPS.activeQuests; i++) {
    P.quest(refusing, "accept", { id: `q${i}`, g: "z1|Giver", verb: "fishing", target: "fish", n: 1 });
  }
  assert.equal(
    P.quest(refusing, "accept", { id: "qX", g: "z1|Giver", verb: "fishing", target: "fish", n: 1 }),
    false,
    "`activeQuests` REFUSES a new quest at the cap",
  );

  // A STUB REMEMBERS WHAT IT STOOD FOR. Re-compaction ran on every append, and
  // an already-stubbed day counted its one stub LINE — so an elided day that
  // held twelve things announced "1 thing happened." the next time anything
  // was logged.
  const ledger = makeCore("chat-ledger", 3535);
  const busy = P.CAPS.ledgerPerDay; // a day at its own per-day cap, then elided
  for (let i = 0; i < busy; i++) P.log(ledger, `thing ${i}`, 1);
  for (let day = 2; day <= 2 + P.CAPS.ledgerDays; day++) P.log(ledger, "later", day);
  const stub = ledger.sim.player.ledger.lines.find((line) => line[0] === 1);
  assert.ok(stub, "day 1 was elided to a stub");
  assert.ok(new RegExp(`${busy} things`).test(stub[1]), `the stub keeps its count (${stub[1]})`);
  P.log(ledger, "one more", 2 + P.CAPS.ledgerDays);
  const again = ledger.sim.player.ledger.lines.find((line) => line[0] === 1);
  assert.ok(new RegExp(`${busy} things`).test(again[1]), `and re-stubbing is idempotent (${again[1]})`);
  assert.equal(
    JSON.parse(JSON.stringify(P.serialize(ledger.sim.player))).ledger.lines.find((l) => l[0] === 1).length,
    3,
    "the count rides the wire as an optional third element",
  );

  // "OLDEST" MEANS OLDEST, ACROSS A RELOAD. serialize() re-orders both of these
  // collections, so array order and key order stop meaning insertion order the
  // moment anything is saved and loaded.
  const found = makeCore("chat-found", 3636);
  P.discover(found, { p: "aaa", e: 0, d: 0, day: 90 }); // sorts FIRST, newest by day
  for (let i = 1; i < P.CAPS.found; i++) P.discover(found, { p: `z${i}`, e: 0, d: 0, day: i });
  const reloaded = P.parse(JSON.parse(JSON.stringify(P.serialize(found.sim.player)))).player;
  found.sim.player = reloaded;
  assert.equal(reloaded.found.zones[0].p, "aaa", "after a reload the array is in (p,e,d) order, not insertion order");
  P.discover(found, { p: "new", e: 0, d: 0, day: 99 });
  assert.ok(
    found.sim.player.found.zones.some((z) => z.p === "aaa"),
    "so the cap must evict by DAY — the newest discovery is not the oldest one",
  );
  assert.ok(!found.sim.player.found.zones.some((z) => z.p === "z1"), "…and the genuinely oldest is what goes");

  // THE `s`-LINE RECENCY MARKER SURVIVES THE WIRE. It lived on `_sAt`, which
  // serialize() dropped, so after a reload every held line sorted equal and the
  // eviction fell back to whatever order the rebuild happened to produce.
  const lines = makeCore("chat-lines", 3737);
  P.bump(lines, "village", "Aaa First", { d: 1, s: "the oldest line there is" });
  for (let i = 1; i < P.CAPS.relLines; i++) P.bump(lines, "village", `Zzz ${i}`, { d: 1, s: `line ${i}` });
  const back = P.parse(JSON.parse(JSON.stringify(P.serialize(lines.sim.player)))).player;
  assert.equal(back.rel.village["Aaa First"].a, 1, "the mark is on the wire, and it is the lowest");
  lines.sim.player = back;
  P.bump(lines, "village", "Newest Person", { d: 1, s: "the newest line there is" });
  assert.equal(
    lines.sim.player.rel.village["Aaa First"].s,
    undefined,
    "so the OLDEST line is what the cap evicts, across a reload",
  );
  assert.equal(lines.sim.player.rel.village["Newest Person"].s, "the newest line there is", "and the newest stays");
  assert.ok(lines.sim.player.rel.village["Aaa First"], "with its row, its ladder and its count intact");

  // …AND IT COSTS A BLOCK THAT PREDATES IT NOTHING. A build before the mark
  // wrote s-lines with no `a` at all, so emitting one unconditionally put
  // `"a":0` on every such row the first time this build re-serialized it —
  // undeclared byte drift on a wire other builds read. Absent means 0 on the way
  // in, so nothing is emitted on the way out.
  const legacy = {
    v: P.serialize(P.defaultPlayer()).v,
    game: 1,
    rel: { z1: { Alder: { d: 2, t: 3, s: "said a thing" } } },
  };
  const reEmitted = P.serialize(P.parse(legacy).player);
  assert.deepEqual(
    reEmitted.rel.z1.Alder,
    { d: 2, t: 3, s: "said a thing" },
    "a parent-written s-line re-serializes without gaining a recency key",
  );
  assert.equal(
    JSON.stringify(P.serialize(P.parse(JSON.parse(JSON.stringify(reEmitted))).player)),
    JSON.stringify(reEmitted),
    "and a second round trip is byte-stable",
  );
  // The ordering still works on those rows, because absent reads back as the
  // oldest possible mark — which is what an unmarked line is.
  const unmarked = P.parse(legacy).player;
  unmarked.rel.z1.Brint = { d: 1, t: 1, s: "a newer line", a: 5 };
  P._evictLines(unmarked);
  for (let i = 0; i < P.CAPS.relLines; i++) unmarked.rel.z1[`Filler ${i}`] = { d: 1, t: 1, s: `f${i}`, a: 10 + i };
  P._evictLines(unmarked);
  assert.equal(unmarked.rel.z1.Alder.s, undefined, "the unmarked line evicts first, as the oldest");
  assert.ok(unmarked.rel.z1.Alder, "…and its row stays, exactly as a marked row's would");
});

// (ao) THE LADDER'S REMAINING SITES.
// Five separate findings, all of them about a site that reads the ladder and
// then does something the ladder did not say.
await withSavePath(async ({ calls, armed, behavior, tick, makeCore }) => {
  // ROW 4's RE-READ DECIDES. The re-read exists because a GET can land inside
  // the PUT route's delete-then-insert window; when it comes back row 8 the row
  // is alive and byte-identical and the world is not stale — but the pre-check
  // blocked anyway and armed nothing, so a whole debounce cycle went nowhere.
  loadedPF.save.mode = "routes";
  const core = makeCore("chat-reread", 4141);
  await loadedPF.save.flush(core, false);
  const anchored = loadedPF.save._serverSerialized;
  calls.length = 0;
  loadedPF.save._lastCheckAt = 0;
  loadedPF.save._lastOkCheckAt = 0;
  let gets = 0;
  behavior.get = async () => {
    gets += 1;
    return gets === 1
      ? { available: true, status: 200, body: { exists: false } }
      : { available: true, status: 200, body: { exists: true, state: JSON.parse(anchored) } };
  };
  core.sim.day += 1;
  await loadedPF.save.flush(core, false);
  assert.equal(gets, 2, "the pre-check's row 4 re-reads once");
  assert.equal(calls.filter((c) => c.kind === "put").length, 1, "and a row that is alive and unchanged is not a block");
  assert.deepEqual(core.toasts, [], "nothing rewound, so nothing is announced");

  // A REWIND STILL OWES THE SERVER A WRITE. _rebuild primes _lastSerialized with
  // the bytes it just built, so the markDirty that follows a rewind deduped to
  // nothing — and on row 4, whose whole finding is that the row is GONE, that
  // meant the row was never re-created.
  loadedPF.save.reset();
  loadedPF.save.mode = "routes";
  const lost = makeCore("chat-forced", 4242);
  await loadedPF.save.flush(lost, false);
  calls.length = 0;
  behavior.get = async () => ({ available: true, status: 200, body: { exists: false } });
  await loadedPF.save.checkRewind(lost);
  assert.deepEqual(lost.toasts, ["The world rewound with the story."], "the row is gone and the world rewound");
  assert.equal(loadedPF.save._forceWrite, true, "so the next write is FORCED past the cache the rebuild just primed");
  assert.ok(loadedPF.save._pendingWrite(lost), "…and there really is a write pending");

  // ROW 9 BLOCKS THE ROUTE PUT, NOT THE WHOLE FLUSH. A GET route that will not
  // answer forbids overwriting a row we have not seen; it says nothing about the
  // write-through metadata cache, which is ours outright and is what a cold boot
  // reads. Stopping all three persistence paths on one unanswered GET was the
  // finding; re-arming a flat unbounded 2.5 s poll to retry it was the other half.
  loadedPF.save.reset();
  loadedPF.save.mode = "routes";
  const dark = makeCore("chat-row9", 4343);
  calls.length = 0;
  armed.length = 0;
  behavior.get = async () => {
    throw Object.assign(new TypeError("NetworkError"), { status: 0 });
  };
  await loadedPF.save.flush(dark, false);
  assert.equal(calls.filter((c) => c.kind === "put").length, 0, "the route PUT is skipped — we have not seen the row");
  assert.equal(calls.filter((c) => c.kind === "patch").length, 1, "but the write-through cache still takes it");
  assert.equal(loadedPF.save._flushFailures, 0, "an unanswered GET is not a failed write and spends no write rung");
  assert.deepEqual(
    armed.map((t) => t.ms),
    [2500],
    "it re-arms on a ladder of its OWN",
  );
  armed.length = 0;
  for (let i = 0; i < 12; i++) {
    // Let each flush see a clear timer, the way an elapsed rung would.
    loadedPF.save._timer = 0;
    loadedPF.save._timerIsBackoff = false;
    dark.sim.day += 1;
    await loadedPF.save.flush(dark, false);
  }
  assert.deepEqual(
    armed.map((t) => t.ms),
    [5000, 10_000, 30_000, 60_000, 60_000, 60_000, 60_000],
    "which climbs and then STOPS, degrading to trigger-driven saves like the write ladder",
  );

  // THE LAST-DETACH FLUSH IS A CHECKED FLUSH. Its own comment says so — "the
  // page is still alive here, so this keeps the ordinary checked flush" — and it
  // was the one write that skipped the pre-check entirely, which made the write
  // most likely to be racing a swipe the one write that never looked.
  loadedPF.save.reset();
  loadedPF.save.mode = "routes";
  const detach = makeCore("chat-detach", 4444);
  behavior.get = async () => ({ available: true, status: 200, body: { exists: false } });
  behavior.put = async () => ({ ok: true, id: "r1" });
  await loadedPF.save.flush(detach, false);
  assert.ok(loadedPF.save._serverSerialized, "the first write anchored the row");
  calls.length = 0;
  // The pre-check's freshness window has lapsed, so this flush owes a real GET.
  loadedPF.save._lastCheckAt = 0;
  loadedPF.save._lastOkCheckAt = 0;
  const elsewhere = { v: 1, seed: 4444, theme: "cozy-village", zone: "inn", day: 30, player: { v: 1, game: 1 } };
  behavior.get = async () => ({ available: true, status: 200, body: { exists: true, state: elsewhere } });
  detach.sim.day += 1;
  await loadedPF.save.flush(detach, true); // 90-element's last-detach call
  assert.equal(calls.filter((c) => c.kind === "get").length, 1, "the detach flush checks the row first");
  assert.equal(calls.filter((c) => c.kind === "put").length, 0, "and row 7 blocks it, exactly as it blocks any other");

  // …AND A CHECKED DETACH DURING A GET OUTAGE STILL WRITES THE CACHE. Row 9
  // withdraws the PUT — a full-snapshot overwrite of a row nobody has seen — and
  // withdraws nothing else. But the clean-gate sat AFTER that downgrade and row 9
  // sets _lastCheck unconditionally, so the gate then re-blocked on the very row
  // that had just been handled and killed the metadata PATCH as well: a detach
  // during an outage wrote NOTHING. The gate protects the ROUTE row, and by that
  // point there is no route write left to protect.
  loadedPF.save.reset();
  loadedPF.save.mode = "routes";
  const outage = makeCore("chat-detach-outage", 4445);
  behavior.get = async () => ({ available: true, status: 200, body: { exists: false } });
  await loadedPF.save.flush(outage, false);
  calls.length = 0;
  loadedPF.save._lastCheckAt = 0;
  loadedPF.save._lastOkCheckAt = 0;
  behavior.get = async () => {
    throw Object.assign(new TypeError("NetworkError"), { status: 0 });
  };
  outage.sim.day += 1;
  await loadedPF.save.flush(outage, true); // 90-element's last-detach call again
  assert.deepEqual(
    calls.map((c) => c.kind),
    ["get", "patch"],
    "the unanswered GET drops the PUT and the write-through cache still lands",
  );
  assert.equal(calls[1].patch.pixelforge.day, outage.sim.day, "carrying the day the player detached on");

  // A PROMOTED SESSION HAS NEVER LOOKED AT ITS ROW. The pin is created BY a
  // row-9 boot probe, and the promotion used to carry that row 9 — with no
  // successful check behind it — straight into routes mode, where the clean-gate
  // read it as a verdict and declined the first pagehide after the promotion.
  loadedPF.save.reset();
  const pinned = makeCore("chat-promoted", 4848);
  behavior.get = async () => {
    throw Object.assign(new TypeError("NetworkError"), { status: 0 });
  };
  await loadedPF.save.adopt(pinned);
  assert.equal(loadedPF.save.mode, "metadata", "a transport failure at boot pins metadata mode");
  assert.equal(loadedPF.save._lastCheck.row, 9, "…on the strength of a row 9 and nothing else");
  behavior.get = async () => ({ available: true, status: 200, body: { exists: false } });
  await loadedPF.save._reprobe(pinned);
  assert.equal(loadedPF.save.mode, "routes", "and the re-probe promotes it when the route comes back");
  assert.equal(loadedPF.save._lastCheck, null, "the pin's row 9 does not cross into routes mode with it");
  assert.equal(loadedPF.save._teardownAllowed(), true, "so the first pagehide after the promotion is not declined");

  // THE TEARDOWN PUT'S SEQUENCE BUMP IS PROCESS-GLOBAL. _flushNow states the
  // invariant and bumps OUTSIDE its generation fence, with a paragraph saying
  // why: _writeSeq is process-wide, and a write that completed on the wire
  // superseded every row a GET could still be holding, whichever chat we are on
  // when it lands. flushTeardown bumped INSIDE the fence, so a chat switch
  // between the pagehide and the response left a stale GET adoptable as
  // authority — which is a rewind onto a row we ourselves replaced.
  loadedPF.save.reset();
  loadedPF.save.mode = "routes";
  const going = makeCore("chat-writeseq", 4545);
  // _writeSeq has no accessor, so it is read the way the ladder reads it: row 5
  // is "a PUT of ours completed while this GET was in flight", and it fires for
  // exactly the values that are not the current one.
  const currentSeq = () => {
    for (let n = 0; n < 500; n++) {
      const decided = loadedPF.save.classify(
        { failed: false, probe: { available: true, body: { exists: true, state: { v: 1 } } } },
        { serverSerialized: '{"v":1}', localSerialized: '{"v":1}', seqAtIssue: n, game: 1 },
      );
      if (decided.row !== 5) return n;
    }
    return -1;
  };
  const before = currentSeq();
  assert.ok(before >= 0, "the sequence is readable through the ladder");
  let release = null;
  behavior.put = () => new Promise((resolve) => (release = () => resolve({ ok: true, id: "r1" })));
  behavior.patch = async () => {};
  going.sim.day += 1;
  loadedPF.save.flushTeardown(going);
  loadedPF.save.reset(); // the chat switched while the keepalive PUT was in flight
  assert.ok(release, "the teardown PUT is on the wire");
  release();
  await tick();
  assert.equal(
    currentSeq(),
    before + 1,
    "a teardown write that lands after a chat switch still supersedes every GET issued before it",
  );
});

// (ao2) THE DAMAGED ROW'S BYTES ARE PARKED WHEREVER THE REPAIR IS COMING.
// Engine #5407 hands the raw stored text back on the failure path only, and the
// write that repairs the row destroys it. Three sites see a row-1
// classification and every one of them is followed by that write, but only boot
// parked the evidence — so a chat that had already booted healthy and met the
// damage at a turn edge repaired it with nothing kept.
await withSavePath(async ({ calls, behavior, tick, makeCore }) => {
  loadedPF.save.mode = "routes";
  const core = makeCore("chat-park-turnedge", 4646);
  await loadedPF.save.flush(core, false);
  calls.length = 0;
  core.toasts.length = 0;
  behavior.get = async () => ({
    available: true,
    status: 200,
    body: { exists: true, state: null, rawState: '{"zone":"village","x":5', rawStateTruncated: false },
  });
  await loadedPF.save.checkRewind(core);
  await tick();
  const parked = calls.find((c) => c.kind === "patch" && c.patch.pixelforgeCorruptExcerpt);
  assert.ok(parked, "a row-1 classification at the TURN EDGE parks the bytes too");
  assert.equal(parked.patch.pixelforgeCorruptExcerpt.text, '{"zone":"village","x":5', "verbatim, bounded");
  assert.deepEqual(core.toasts, [], "…and stays silent there: nothing visibly changed and nothing is repaired yet");

  // …and the pre-check, which is the site with the repairing PUT immediately
  // behind it, both parks and says so — once.
  loadedPF.save.reset();
  loadedPF.save.mode = "routes";
  const flushing = makeCore("chat-park-precheck", 4747);
  behavior.get = async () => ({ available: true, status: 200, body: { exists: false } });
  await loadedPF.save.flush(flushing, false);
  loadedPF.save._lastCheckAt = 0; // the freshness window has lapsed, so the next flush re-checks
  loadedPF.save._lastOkCheckAt = 0;
  calls.length = 0;
  flushing.toasts.length = 0;
  behavior.get = async () => ({
    available: true,
    status: 200,
    body: { exists: true, state: null, rawState: "z".repeat(120), rawStateTruncated: false },
  });
  flushing.sim.day += 1;
  await loadedPF.save.flush(flushing, false);
  await tick();
  assert.ok(
    calls.find((c) => c.kind === "patch" && c.patch.pixelforgeCorruptExcerpt),
    "the pre-check parks before letting its PUT repair the row",
  );
  assert.equal(calls.filter((c) => c.kind === "put").length, 1, "and the PUT still goes — the write IS the repair");
  assert.deepEqual(flushing.toasts, ["This world's saved row was damaged. It is being written fresh."], "told once");
  flushing.sim.day += 1;
  flushing.toasts.length = 0;
  await loadedPF.save.flush(flushing, false);
  assert.deepEqual(flushing.toasts, [], "…once per chat, not once per flush");
});

// (ap) §Q2a's OTHER HALF: THE ROW WINS AT ADOPT, AND THE PLAYER IS TOLD.
// The rule shipped with the rebuild and without the sentence. Row 6's LADDER
// toast is null because a rewind CHECK latches it in silence — nothing visibly
// changed mid-session. At boot the world the metadata just built is replaced
// under them, which is the one time they need to know, so the message is a row
// of the ladder rather than a string at the site.
await withSavePath(async ({ behavior, makeCore }) => {
  for (const [row, serverState] of [
    [6, { v: 1, seed: 5151, theme: "cozy-village", zone: "inn", day: 21, player: { v: 1, game: 1 } }],
    [7, { v: 1, seed: 5151, theme: "cozy-village", zone: "forest", day: 22, player: { v: 1, game: 1 } }],
  ]) {
    loadedPF.save.reset();
    const core = makeCore("chat-adopt-toast", 5151);
    behavior.get = async () => ({ available: true, status: 200, body: { exists: true, state: serverState } });
    if (row === 7) loadedPF.save._anchorMoved = true; // an echo from an anchor nobody checked
    await loadedPF.save.adopt(core);
    assert.equal(loadedPF.save.mode, "routes", `row ${row} is a routes-mode adopt`);
    assert.deepEqual(core.toasts, ["The world rewound with the story."], `row ${row} tells the player at ADOPT`);
    assert.equal(core.sim.zoneId, serverState.zone, "…and the row is what they are standing in");
  }
  // …while the rewind CHECK keeps row 6 silent, which is the difference the
  // ladder now carries explicitly.
  const atRewind = loadedPF.save.classify(
    { failed: false, probe: { available: true, body: { exists: true, state: { v: 1, a: 1 } } } },
    { serverSerialized: null, localSerialized: '{"v":1}', game: 1 },
  );
  assert.equal(atRewind.row, 6, "the same difference with no anchor of our own is row 6");
  assert.equal(atRewind.toast, null, "whose REWIND-site toast is still null — a latch is not an announcement");
  assert.equal(
    atRewind.adoptToast,
    "The world rewound with the story.",
    "while its ADOPT-site message is the one above",
  );
});

// (aq) THE MINT STAMP CARRIES NO RAW CONTROL BYTES — AND NEITHER DOES ANY OTHER
// MODULE.
// mintStampOf built its hash input with two literal U+0000 bytes in the source.
// The stamp is what every save's severance verdict turns on, so any tool that
// normalizes control characters on the way through the repo — an editor, a
// patch round-trip, a copy through a form — would change every stamp and sever
// every save in the wild. An escaped U+0000 hashes identically and cannot be
// normalized
{
  const sealed = brief.validate(
    {
      scale: "village",
      name: "Mossbrook",
      backgroundPopulation: 30,
      situation: "The north field is sinking.",
      cast: [
        { name: "Alder Vance", role: "mayor", kind: "leader", tint: "blue", home: "Mossbrook", household: 1 },
        { name: "Perrin Quill", role: "innkeep", kind: "host", tint: "amber", home: "Mossbrook", household: 2 },
        { name: "Old Sera", role: "weaver", kind: "elder", tint: "rose", home: "Mossbrook", household: 3 },
      ],
    },
    { theme: "cozy-village", seed: 424242 },
  );
  // Pinned to the values the RAW-byte version produced, measured at 3511a153.
  assert.equal(
    world.build(424242, "cozy-village", sealed).mintStamp,
    3_114_775_167,
    "a generated mint stamps the same",
  );
  assert.equal(world.build(9001, "cozy-village").mintStamp, 2_496_143_703, "and a legacy one does too");
  // THE WHOLE PACKAGE, and not the file the incident happened in. A guard that
  // reads 20-world alone pins the one module where this has already been found
  // and fixed, and watches nothing: a raw byte is a property of the SOURCE TREE —
  // any editor, patch round-trip or copy-through-a-form can leave one in any file
  // — and the corruption this slice actually hit landed in 59-economy, outside
  // the guard's one file. Read in name order so the failure is stable, and every
  // module names itself if it is the one carrying the byte.
  const modules = readdirSync(join(here, "src"))
    .filter((name) => name.endsWith(".js"))
    .sort();
  assert.ok(
    modules.includes("20-world.js") && modules.includes("59-economy.js"),
    `the sweep really did read the src directory (${modules.length} modules)`,
  );
  for (const name of modules) {
    assert.ok(
      !readFileSync(join(here, "src", name), "utf8").includes(String.fromCharCode(0)),
      `src/${name} carries no raw control byte for anything to normalize`,
    );
  }
}

// ═══ THE LOADING GATE (S5 slice 5) ═════════════════════════════════════════

// The raw brief a stubbed #5135 call hands back. Deliberately the model's OWN
// shape (pre-validate): brief.generate runs the shipped ladder over it, so these
// cases exercise the real seal path rather than a hand-sealed object.
const gateBriefData = {
  scale: "village",
  name: "Fallowmere",
  prosperity: "modest",
  backgroundPopulation: 40,
  situation: "The bridge went in the spring flood and the ford is the only way across.",
  cast: [
    { name: "Perrin Quill", role: "innkeep", kind: "host", tint: "amber", home: "Fallowmere", household: 1 },
    { name: "Wren Ash", role: "miller", kind: "maker", tint: "teal", home: "Fallowmere", household: 2 },
  ],
};
/** Wrap a case that drives generation: stubs the ONE host call the ladder makes
 *  and puts it back, and clears the two module-level caches the gate keeps so no
 *  case inherits another's sealed brief or in-flight marker. */
const withGeneration = async (run) => {
  const realGenerate = loadedPF.api.postExperienceGeneration;
  const responses = { post: async () => ({ status: 200, body: { ok: true, data: gateBriefData } }) };
  let posts = 0;
  loadedPF.api.postExperienceGeneration = (chatId, body, signal) => {
    posts += 1;
    return responses.post(chatId, body, signal);
  };
  loadedPF.save._briefCache.clear();
  loadedPF.save._generating.clear();
  try {
    await run({ responses, postCount: () => posts });
  } finally {
    loadedPF.api.postExperienceGeneration = realGenerate;
    loadedPF.save._briefCache.clear();
    loadedPF.save._generating.clear();
    loadedPF.save.gate = null;
  }
};

// (ar) THE GATE HOLDS PLAY, AND HOLDS IT AT EVERY DOOR.
// Maintainer ruling #7: a player must never invest in a world that is going to be
// discarded, so a generate-configured chat whose brief is not sealed does not
// enter play at all. "Does not enter play" has to mean every door at once — the
// probe, the debounce, the chat-switch capture, the last-detach flush, pagehide,
// and every mutator — because the throwaway world's whole failure mode was that
// each of those looked individually harmless.
await withSavePath(async ({ calls, armed, behavior, tick, makeCore }) => {
  await withGeneration(async ({ responses, postCount }) => {
    const P = loadedPF.player;
    const meta = { gameSetupConfig: { experienceConfig: { generate: true, seed: 4242, theme: "cozy-village" } } };
    const core = makeCore("chat-gate", 4242);
    core.host.chatMeta = meta;
    core.sim = loadedPF.save.restore(meta, "chat-gate");
    assert.equal(core.sim.world.interim, true, "the placeholder world is still MARKED — the net under the gate");
    assert.equal(loadedPF.save.armGate(core, meta), true, "a generate-configured chat with no sealed brief gates");
    assert.equal(loadedPF.save.gateHolds(core), true, "and the gate holds for this chat");
    assert.equal(loadedPF.save.gate.state, "generating", "starting in the state the loading panel renders");

    // ── NOT ONE BYTE REACHES THE WIRE ──
    calls.length = 0;
    armed.length = 0;
    core.sim.day += 1;
    core.sim.dirty = true;
    loadedPF.save.markDirty(core);
    assert.equal(armed.length, 0, "markDirty arms no timer at all — a world nobody is in costs no wakeups");
    assert.equal(loadedPF.save.captureFlush(core), null, "a chat switch captures nothing to write");
    await loadedPF.save.flush(core, false);
    await loadedPF.save.flush(core, true); // the last-detach flush
    loadedPF.save.flushTeardown(core); // pagehide, which builds its own snapshot
    await loadedPF.save.adopt(core);
    await loadedPF.save.checkRewind(core);
    await tick();
    assert.deepEqual(calls, [], "nothing went out: not the probe, not the debounce, not the detach, not pagehide");
    assert.equal(loadedPF.save.mode, null, "and the routes probe never ran, so no mode was even chosen");

    // ── NO MUTATOR RESOLVES, EACH REFUSING IN ITS OWN DOCUMENTED SHAPE ──
    const refusals = [
      ["grant", P.grant(core, "apple", 2), 0],
      ["take", P.take(core, "apple", 1), false],
      ["award", P.award(core, { money: 10, xp: 5, verb: "fishing" }), null],
      ["equip", P.equip(core, "fishing", "tool", { t: "rod", k: "fine" }), false],
      ["bump", P.bump(core, "village", "Someone", { d: 2, s: "a line" }), null],
      ["quest", P.quest(core, "accept", { id: "q1", g: "z1|Someone", verb: "fishing", target: "fish", n: 2 }), false],
      ["log", P.log(core, "a thing happened", 3), false],
      ["discover", P.discover(core, { p: "z2", e: 0, d: 0 }), false],
      ["setHome", P.setHome(core, "inn"), false],
    ];
    for (const [verb, got, want] of refusals) {
      assert.deepEqual(got, want, `${verb}() refuses behind the gate with its documented value`);
    }
    const untouched = P.get(core);
    assert.deepEqual(untouched.pouch, { money: 0, items: [] }, "and the block is exactly as it booted");
    assert.deepEqual(untouched.rel, {}, "no relationship rows");
    assert.deepEqual(untouched.ledger.lines, [], "no ledger lines");
    assert.equal(untouched.home, null, "and no home");

    // ── THE BRIEF SEALS, AND ONLY THEN DOES ANYTHING HAPPEN ──
    behavior.get = async () => ({ available: true, status: 200, body: { exists: false } });
    calls.length = 0;
    armed.length = 0;
    await loadedPF.save.maybeGenerateBrief(core);
    await tick();
    assert.equal(postCount(), 1, "exactly one host generation call");
    assert.ok(
      calls.find((c) => c.kind === "patch" && c.patch.pixelforgeBrief),
      "the sealed brief is stored under its own key",
    );
    assert.equal(loadedPF.save.gate, null, "the gate lifts");
    assert.equal(loadedPF.save.gateHolds(core), false, "…for this chat");
    assert.equal(core.sim.world.brieved, true, "onto the world the brief describes");
    assert.equal(core.sim.world.interim, undefined, "which is not a throwaway, so the mark is gone");
    assert.equal(loadedPF.save.mode, "routes", "adopt ran on the way out of the gate, not before it");
    // S3's starting purse rides the same moment (slice 6): a sink with no source
    // is not a feature, and the seal is the one unambiguous "this world begins".
    assert.equal(P.get(core).pouch.money, loadedPF.economy.STARTING_PURSE, "and the world begins with a purse in it");
    assert.equal(P.grant(core, "apple", 2), 2, "and the mutators answer again");

    // …and the first save of the chat's life is the compiled world, not the
    // placeholder: the debounce the lift armed is the one that carries it.
    const debounce = armed.find((t) => t.ms === 2500);
    assert.ok(debounce, "the lift arms an ordinary debounce");
    calls.length = 0;
    debounce.fn();
    await loadedPF.save._flushChain;
    const wrote = calls.find((c) => c.kind === "put");
    assert.ok(wrote, "which writes");
    assert.equal(wrote.state.seed, core.sim.world.seed, "carrying the compiled world");

    // ── A FAILED GENERATION IS A RETRY SCREEN, NEVER A SEALED DEFAULT ──
    loadedPF.save.reset();
    loadedPF.save._briefCache.clear();
    const core2 = makeCore("chat-gate-fail", 909);
    core2.host.chatMeta = { gameSetupConfig: { experienceConfig: { generate: true, seed: 909 } } };
    core2.sim = loadedPF.save.restore(core2.host.chatMeta, "chat-gate-fail");
    assert.equal(loadedPF.save.armGate(core2, core2.host.chatMeta), true, "gated");
    calls.length = 0;
    // 503 is the ladder's transient verdict: null, nothing stored. The block below
    // does the deterministic one, which since 0.11 answers the same way.
    responses.post = async () => ({ status: 503, body: null });
    await loadedPF.save.maybeGenerateBrief(core2);
    await tick();
    assert.equal(loadedPF.save.gate.state, "failed", "the gate shows its failure state");
    assert.equal(loadedPF.save.gate.attempts, 1, "counting the attempt");
    assert.equal(
      calls.filter((c) => c.kind === "patch").length,
      0,
      "and NOTHING was sealed — no default world decided on the player's behalf",
    );
    assert.equal(loadedPF.save.gateHolds(core2), true, "play is still held");
    assert.equal(loadedPF.player.grant(core2, "apple", 1), 0, "…mutators included");
    // …and because nothing was written, the chat is still exactly a chat waiting
    // for a brief: the next visit arms the gate again and tries again on its own.
    // That is the whole never-a-bricked-chat argument, and it is a property of the
    // stored state rather than of anything this session remembers.
    assert.equal(
      loadedPF.save.briefExpected(core2.host.chatMeta, "chat-gate-fail"),
      true,
      "a failed generation leaves the chat in the state that re-arms the gate on the next visit",
    );
    assert.equal(loadedPF.save.gate.failure, "unavailable", "and the panel knows WHY, not only that it failed");

    // The retry is a real retry: same chat, same gate, one more host call.
    responses.post = async () => ({ status: 200, body: { ok: true, data: gateBriefData } });
    assert.equal(loadedPF.save.retryGeneration(core2), true, "the failure screen's button re-runs generation");
    assert.equal(loadedPF.save.gate.state, "generating", "flipping the panel back synchronously");
    for (let i = 0; i < 50 && loadedPF.save.gate; i++) await tick();
    assert.equal(loadedPF.save.gate, null, "and the retry seals it");
    assert.equal(postCount(), 3, "one call for the failure, one for the retry, on top of the first chat's");

    // ── AND A DETERMINISTIC FAILURE IS THE SAME SCREEN (DESIGN REVISION) ──
    // The 0.4.0 ladder sealed a themed default on a 400/422, reasoning that a paid
    // call per visit is worse than the default world. That predates the gate: back
    // then the default world was what the player was already walking in, so sealing
    // it changed nothing they could see. Now it would write down a world nobody
    // asked for, permanently, in the one case a player cannot undo — while the
    // README promises "a generation failure is a retry screen; nothing is stored".
    // Revised: no failure seals anything. The gate carries the KIND instead, so a
    // deterministic refusal is not a mystery button that never works.
    {
      loadedPF.save.reset();
      loadedPF.save._briefCache.clear();
      const refused = makeCore("chat-gate-400", 400);
      refused.host.chatMeta = { gameSetupConfig: { experienceConfig: { generate: true, seed: 400 } } };
      refused.sim = loadedPF.save.restore(refused.host.chatMeta, "chat-gate-400");
      assert.equal(loadedPF.save.armGate(refused, refused.host.chatMeta), true, "gated");
      calls.length = 0;
      responses.post = async () => ({ status: 400, body: { code: "user_content_too_long" } });
      await loadedPF.save.maybeGenerateBrief(refused);
      await tick();
      assert.equal(loadedPF.save.gate.state, "failed", "a 400 is a retry screen");
      assert.equal(loadedPF.save.gate.failure, "refused", "…that says the request was turned down, not delayed");
      assert.equal(
        calls.filter((c) => c.kind === "patch").length,
        0,
        "and NOTHING is sealed — no themed default written down where the player cannot undo it",
      );
      assert.equal(
        loadedPF.save.briefExpected(refused.host.chatMeta, "chat-gate-400"),
        true,
        "the chat is still exactly a chat waiting for a brief",
      );
      assert.equal(refused.sim.world.brieved, undefined, "and the world under the gate is still the placeholder");
      // The sentences are pinned HERE and not in 70-hud, which the harness cannot
      // load: a string the player reads with nothing asserting it is a string that
      // drifts. "refused" earns its own, because trying again really may not help.
      assert.notEqual(
        loadedPF.save.gateReason("refused"),
        loadedPF.save.gateReason("unavailable"),
        "a refusal and a busy engine do not read the same",
      );
      for (const kind of ["refused", "unavailable", "network", "timeout", "storage", null, "a-kind-from-the-future"]) {
        const text = loadedPF.save.gateReason(kind);
        assert.ok(text && text.trim().endsWith("."), `${kind} has a whole sentence, not a blank panel`);
      }
      // The retry clears the verdict: the panel must not still be explaining the
      // last failure while a new call is in flight behind it.
      responses.post = async () => ({ status: 200, body: { ok: true, data: gateBriefData } });
      assert.equal(loadedPF.save.retryGeneration(refused), true, "the button runs");
      assert.equal(loadedPF.save.gate.state, "generating", "flipping the panel back synchronously");
      assert.equal(loadedPF.save.gate.failure, null, "…and clearing the verdict, so it stops explaining a dead one");
      for (let i = 0; i < 50 && loadedPF.save.gate; i++) await tick();
      assert.equal(loadedPF.save.gate, null, "and a refusal is not permanent — the retry seals a real world");
      assert.equal(refused.sim.world.brieved, true, "…which compiles");
      loadedPF.save.reset();
      loadedPF.save._briefCache.clear();
    }

    // ── THE LIFT COMES BEFORE THE DIRTY FLAG, AND THIS IS WHERE THAT SHOWS ──
    // markDirty refuses while the gate holds, so arming the save first would arm
    // nothing. On the routes path adopt covers for it (its first-write branch
    // dirties the world itself), which is exactly why that path cannot pin the
    // ordering. An engine with no experience-state route picks metadata mode and
    // returns without dirtying anything, so the trailing markDirty in
    // maybeGenerateBrief is the only thing that will ever carry the compiled
    // world to disk.
    loadedPF.save.reset();
    loadedPF.save._briefCache.clear();
    const legacyEngine = makeCore("chat-gate-legacy", 5150);
    legacyEngine.host.chatMeta = { gameSetupConfig: { experienceConfig: { generate: true, seed: 5150 } } };
    legacyEngine.sim = loadedPF.save.restore(legacyEngine.host.chatMeta, "chat-gate-legacy");
    assert.equal(loadedPF.save.armGate(legacyEngine, legacyEngine.host.chatMeta), true, "gated");
    behavior.get = async () => ({ available: false, status: 404 }); // pre-#5102 engine
    calls.length = 0;
    armed.length = 0;
    await loadedPF.save.maybeGenerateBrief(legacyEngine);
    await tick();
    assert.equal(loadedPF.save.gate, null, "the brief seals and the gate lifts");
    assert.equal(loadedPF.save.mode, "metadata", "on an engine with no experience-state route");
    const onlyDebounce = armed.find((t) => t.ms === 2500);
    assert.ok(onlyDebounce, "and the lift's own debounce is armed — nothing else here would write this world");
    calls.length = 0;
    onlyDebounce.fn();
    await loadedPF.save._flushChain;
    assert.ok(
      calls.find((c) => c.kind === "patch" && c.patch.pixelforge),
      "which carries the compiled world to the metadata key",
    );

    // ── AND A THROW IS A RETRY SCREEN TOO, NOT A SPINNER FOREVER ──
    // Every failure the generation ladder KNOWS about comes back as a null seal
    // and is handled above. This is the one it does not: a throw out of the
    // compile, the transplant or the park, after the gate is already armed. Left
    // to escape it takes the `finally` on the way out, clears the in-flight
    // marker, and leaves the panel reading "writing your world…" with no call
    // behind it and no button to press — a bricked chat by another route.
    loadedPF.save.reset();
    loadedPF.save._briefCache.clear();
    const thrower = makeCore("chat-gate-throw", 5151);
    thrower.host.chatMeta = { gameSetupConfig: { experienceConfig: { generate: true, seed: 5151 } } };
    thrower.sim = loadedPF.save.restore(thrower.host.chatMeta, "chat-gate-throw");
    assert.equal(loadedPF.save.armGate(thrower, thrower.host.chatMeta), true, "gated");
    // The throw is planted where a real one would land: the rebuild.
    const realSim = loadedPF.Sim;
    loadedPF.Sim = function Exploding() {
      throw new TypeError("the compiled world would not build");
    };
    try {
      await loadedPF.save.maybeGenerateBrief(thrower);
      await tick();
    } finally {
      loadedPF.Sim = realSim;
    }
    assert.ok(loadedPF.save.gate, "the gate is still there rather than half-lifted");
    assert.equal(loadedPF.save.gate.state, "failed", "…showing retry, not a spinner with nothing behind it");
    assert.equal(loadedPF.save._generating.has("chat-gate-throw"), false, "and nothing is left marked in flight");

    // ── AND THE BUTTON ON THAT SCREEN LANDS IN THE REAL WORLD ──
    // The half this case used to stop one line short of, and the reason it
    // mattered: every throw the guard above catches lands AFTER the brief is
    // stored and cached, so by the time the player presses "Try again" the chat
    // no longer expects a brief and the retry takes the nothing-to-generate
    // branch. That branch lifted the gate BARE — onto the placeholder — so the
    // retry started play in the throwaway world, adopt's first-write wrote it up
    // stamped {briefHash:0, interim:1}, and everything played there was severed
    // unrecoverably the next time the real world compiled. A world that is
    // already sealed is recompiled from what was sealed.
    assert.equal(loadedPF.save._briefCache.has("chat-gate-throw"), true, "the brief did seal before the throw");
    assert.equal(
      loadedPF.save.briefExpected(thrower.host.chatMeta, "chat-gate-throw"),
      false,
      "…so the retry finds nothing left to generate, which is the branch that used to lift bare",
    );
    assert.equal(thrower.sim.world.interim, true, "and the world under the gate is still the placeholder");
    behavior.get = async () => ({ available: true, status: 200, body: { exists: false } });
    calls.length = 0;
    armed.length = 0;
    const postsBeforeRetry = postCount();
    assert.equal(loadedPF.save.retryGeneration(thrower), true, "the failure screen's button runs");
    for (let i = 0; i < 50 && loadedPF.save.gate; i++) await tick();
    assert.equal(loadedPF.save.gate, null, "the gate lifts");
    assert.equal(postCount(), postsBeforeRetry, "without paying for a second generation — the brief is already sealed");
    assert.equal(thrower.sim.world.brieved, true, "onto the world the sealed brief describes");
    assert.equal(thrower.sim.world.interim, undefined, "which is not the placeholder any more");
    assert.equal(
      P.get(thrower).pouch.money,
      loadedPF.economy.STARTING_PURSE,
      "and the purse the throw cost is paid on the way in",
    );
    const retryDebounce = armed.find((t) => t.ms === 2500);
    assert.ok(retryDebounce, "the lift arms the ordinary debounce");
    calls.length = 0;
    retryDebounce.fn();
    await loadedPF.save._flushChain;
    const retryWrote = calls.find((c) => c.kind === "put");
    assert.ok(retryWrote, "which writes");
    assert.equal(retryWrote.state.seed, thrower.sim.world.seed, "carrying the COMPILED seed");
    assert.equal(retryWrote.state.zone, thrower.sim.zoneId, "and the compiled world's zone, not the placeholder's");
    assert.ok(
      Object.prototype.hasOwnProperty.call(thrower.sim.world.zones, retryWrote.state.zone),
      "…which is a zone of the world that actually exists now",
    );
    assert.equal(retryWrote.state.player.world.interim, undefined, "the row is not stamped interim");
    assert.ok(retryWrote.state.player.world.briefHash, "and it carries the sealed brief's hash");

    // ── AND THE LIFT ITSELF REFUSES THE PLACEHOLDER, WHOEVER ASKS ──
    // Belt and braces under the branch above: the gate's promise is that nobody
    // plays a world that is going to be discarded, so lifting onto an interim
    // world is a bug wherever it comes from. Every caller's job is to rebuild
    // first and lift second, and this is what stops a future one from quietly
    // re-opening the hole.
    {
      const stuck = makeCore("chat-gate-interim", 5153);
      stuck.host.chatMeta = { gameSetupConfig: { experienceConfig: { generate: true, seed: 5153 } } };
      loadedPF.save.reset();
      stuck.sim = loadedPF.save.restore(stuck.host.chatMeta, "chat-gate-interim");
      assert.equal(stuck.sim.world.interim, true, "the placeholder is marked");
      assert.equal(loadedPF.save.armGate(stuck, stuck.host.chatMeta), true, "gated");
      loadedPF.save._liftGate(stuck);
      assert.ok(loadedPF.save.gate, "_liftGate refuses to start play in the placeholder world");
      assert.equal(loadedPF.save.gateHolds(stuck), true, "…and the gate is still holding every door");
      loadedPF.save.reset();
    }

    // ── AND A SKIPPED MARKER LANDING MID-GATE LIFTS WITHOUT A PURSE ──
    // The marker path shares the install tail with the sealed path, and the tail
    // pays the starting purse — but a default world is not a world beginning, it
    // is the world that has always been there. armGate already pays a declined
    // chat nothing at boot; the mid-gate route must agree, or two chats standing
    // in the IDENTICAL themed default hold different money depending on nothing
    // but which door they came through.
    {
      loadedPF.save.reset();
      loadedPF.save._briefCache.clear();
      const declined = makeCore("chat-gate-declined", 5154);
      declined.host.chatMeta = { gameSetupConfig: { experienceConfig: { generate: true, seed: 5154 } } };
      declined.sim = loadedPF.save.restore(declined.host.chatMeta, "chat-gate-declined");
      assert.equal(loadedPF.save.armGate(declined, declined.host.chatMeta), true, "gated");
      declined.host.chatMeta.pixelforgeBrief = { skipped: true };
      await loadedPF.save.maybeGenerateBrief(declined);
      for (let i = 0; i < 50 && loadedPF.save.gate; i++) await tick();
      assert.equal(loadedPF.save.gate, null, "the marker lifts the gate");
      assert.equal(declined.sim.world.interim, undefined, "onto the themed default, not the placeholder");
      assert.equal(declined.sim.world.brieved, undefined, "which no brief describes");
      assert.equal(
        P.get(declined).pouch.money,
        0,
        "and a marker-lifted default world holds no purse — sealed worlds only",
      );
      loadedPF.save.reset();
    }

    // ── AND A THROW BEFORE THE SEAL IS STILL JUST A RETRY ──
    // The other half of the same branch: nothing was stored, so "Try again" is a
    // real second generation call and not a recompile of something that is not
    // there. Pinned because the fix above put a rebuild in front of the bare lift.
    loadedPF.save.reset();
    loadedPF.save._briefCache.clear();
    const early = makeCore("chat-gate-early", 5152);
    early.host.chatMeta = { gameSetupConfig: { experienceConfig: { generate: true, seed: 5152 } } };
    early.sim = loadedPF.save.restore(early.host.chatMeta, "chat-gate-early");
    assert.equal(loadedPF.save.armGate(early, early.host.chatMeta), true, "gated");
    responses.post = async () => {
      throw new TypeError("the host route blew up");
    };
    await loadedPF.save.maybeGenerateBrief(early);
    await tick();
    assert.equal(loadedPF.save.gate.state, "failed", "a throw before the seal is a retry screen too");
    assert.equal(loadedPF.save._briefCache.has("chat-gate-early"), false, "with nothing sealed");
    const postsBeforeEarly = postCount();
    responses.post = async () => ({ status: 200, body: { ok: true, data: gateBriefData } });
    assert.equal(loadedPF.save.retryGeneration(early), true, "the button runs");
    for (let i = 0; i < 50 && loadedPF.save.gate; i++) await tick();
    assert.equal(postCount(), postsBeforeEarly + 1, "and THIS retry does pay for a generation, because none landed");
    assert.equal(early.sim.world.brieved, true, "sealing the world it came back with");

    // ── AND A CHAT THAT IS NOT WAITING FOR A BRIEF NEVER GATES ──
    for (const [label, chatMeta] of [
      ["a legacy chat with no config at all", {}],
      ["a chat that never asked for generation", { gameSetupConfig: { experienceConfig: { seed: 5 } } }],
      [
        "a chat whose generation was declined",
        { gameSetupConfig: { experienceConfig: { generate: true } }, pixelforgeBrief: { skipped: true } },
      ],
    ]) {
      loadedPF.save.reset();
      const plain = makeCore("chat-plain", 77);
      plain.host.chatMeta = chatMeta;
      assert.equal(loadedPF.save.armGate(plain, chatMeta), false, `${label} plays immediately`);
    }
  });
});

// (as) THE GATE IS ESCAPE-SAFE IN BOTH DIRECTIONS.
// Leaving a chat while its world is being written is the ordinary thing to do
// with a minute-long wait on screen, and it used to have two bad ends. With one
// in-flight FLAG, the chat you arrived at found generation "already running",
// returned immediately, and sat behind a gate with nothing behind it — a bricked
// chat made by walking away from a different one. And a generation that landed
// while you were elsewhere could not patch that chat's host metadata, so coming
// back read a chat that still looked unsealed and generated the world a SECOND
// time — a wasted host call and a different world than the one already stored.
await withSavePath(async ({ tick, makeCore }) => {
  await withGeneration(async ({ responses, postCount }) => {
    // ONE core object for the whole dance, because the surface has exactly one
    // (PF.core): a chat switch REASSIGNS chatId/sim/host on it rather than making
    // a new one, and every fence under test is about that reassignment. Separate
    // per-chat objects would let a stale completion "succeed" against an object
    // nobody is looking at and prove nothing.
    const core = makeCore("chat-away-a", 31);
    const enter = (chatId, meta) => {
      // What 90-element's _switchChat does, in the same order.
      loadedPF.save.reset();
      core.chatId = chatId;
      core.sim = loadedPF.save.restore(meta, chatId);
      core.host.chatMeta = meta;
      return loadedPF.save.armGate(core, meta);
    };
    const metaA = { gameSetupConfig: { experienceConfig: { generate: true, seed: 31, theme: "cozy-village" } } };
    const metaB = {};
    let release;
    const held = new Promise((resolve) => (release = resolve));
    responses.post = async () => {
      await held;
      return { status: 200, body: { ok: true, data: gateBriefData } };
    };

    // Chat A gates and starts generating.
    assert.equal(enter("chat-away-a", metaA), true, "A gates");
    void loadedPF.save.maybeGenerateBrief(core);
    await tick();
    assert.equal(postCount(), 1, "and its one call is in flight");

    // The player leaves for a chat that is not waiting for anything.
    assert.equal(enter("chat-away-b", metaB), false, "B is a legacy chat and plays at once");
    assert.equal(loadedPF.save.gate, null, "leaving cleared the gate with the rest of the per-chat state");
    await loadedPF.save.maybeGenerateBrief(core);
    assert.equal(postCount(), 1, "B starts no generation of its own — the in-flight set is keyed by chat");
    assert.equal(loadedPF.save.gateHolds(core), false, "and A's in-flight call does not gate B");

    // …and a chat that IS waiting for a brief gets its own call while A's is
    // still in flight. This is where ONE in-flight flag bricked a chat by proxy:
    // D gated, asked for generation, was told one was already running, and sat
    // behind a loading panel with nothing at all behind it — a chat made
    // unplayable by walking away from a different one.
    const metaD = { gameSetupConfig: { experienceConfig: { generate: true, seed: 34, theme: "cozy-village" } } };
    responses.post = async () => ({ status: 200, body: { ok: true, data: gateBriefData } });
    assert.equal(enter("chat-away-d", metaD), true, "D gates");
    await loadedPF.save.maybeGenerateBrief(core);
    assert.equal(postCount(), 2, "and starts a call of its own, A's notwithstanding");
    assert.equal(loadedPF.save.gate, null, "so D's gate lifts on D's own brief");
    assert.equal(core.sim.world.brieved, true, "onto D's compiled world");

    // Back to B, so the player is elsewhere when A finally lands.
    assert.equal(enter("chat-away-b", metaB), false, "B still plays at once");

    // A's generation lands while the player is in B: it seals, and it must not
    // touch the world the player is actually standing in.
    release();
    for (let i = 0; i < 50 && !loadedPF.save._briefCache.has("chat-away-a"); i++) await tick();
    assert.equal(loadedPF.save._briefCache.has("chat-away-a"), true, "A's brief is sealed and cached");
    assert.equal(core.chatId, "chat-away-b", "the player is still in B");
    assert.equal(core.sim.world.brieved, undefined, "and B's world is untouched by A's brief landing");

    // Back to A. The host's chatMeta has NOT caught up — it is the same object it
    // always was — so the session cache is the only thing that knows.
    assert.equal(enter("chat-away-a", metaA), false, "coming back does not re-arm the gate");
    assert.equal(core.sim.world.brieved, true, "because the world that was already sealed compiles");
    assert.equal(core.sim.world.interim, undefined, "not a placeholder");
    await loadedPF.save.maybeGenerateBrief(core);
    assert.equal(postCount(), 2, "and the world is NOT generated a second time");
    // …AND THE WORLD BEGINS WITH A PURSE IN IT, which walking away used to cost
    // permanently. The grant's only call site was the tail of the generation, and
    // that tail returns at the chat fence a few lines above it — so a player who
    // did the ordinary thing with a minute-long wait on screen came back to a
    // sealed world, a working berth counter, and no money, forever. The grant is a
    // property of the STATE now: a sealed, non-interim world arriving on a block
    // nothing has been written into is paid whichever door it came through.
    assert.equal(
      loadedPF.player.get(core).pouch.money,
      loadedPF.economy.STARTING_PURSE,
      "leaving during generation and coming back does not cost the starting purse",
    );
    assert.equal(loadedPF.player.get(core).ledger.lines.length, 1, "…and it is said out loud, exactly once");
    enter("chat-away-a", metaA);
    assert.equal(
      loadedPF.player.get(core).pouch.money,
      loadedPF.economy.STARTING_PURSE,
      "…and a third visit does not pay it again",
    );

    // A RELOAD BETWEEN THE SEAL AND THE LIFT IS THE SAME DEBT. The brief reached
    // the metadata, the process died before the world compiled, and the chat comes
    // back with no save row of its own — the gate refused every write, so there
    // never was one. Nothing this session remembers is involved: the metadata is
    // the whole story, which is what makes this the reload case rather than the
    // cache case above.
    loadedPF.save._briefCache.clear();
    const metaReload = {
      gameSetupConfig: { experienceConfig: { generate: true, seed: 31, theme: "cozy-village" } },
      pixelforgeBrief: loadedPF.brief.validate(gateBriefData, { theme: "cozy-village", seed: 31 }),
    };
    assert.equal(enter("chat-reload", metaReload), false, "a sealed chat does not gate on reload");
    assert.equal(core.sim.world.brieved, true, "it boots straight into the compiled world");
    assert.equal(
      loadedPF.player.get(core).pouch.money,
      loadedPF.economy.STARTING_PURSE,
      "and the purse the crash landed between is paid on arrival",
    );

    // …but NOT to a chat that has been played and spent down to nothing. The
    // predicate is "a block nothing has been written into", not "an empty purse",
    // and a veteran being handed a second starting purse every time they walked in
    // broke is the failure the wider test exists to refuse.
    const veteran = loadedPF.player.get(core);
    veteran.pouch.money = 0;
    veteran.ledger.lines = [];
    veteran.found.zones = ["z2"];
    enter("chat-reload", metaReload);
    core.sim.player = veteran;
    assert.equal(loadedPF.economy.grantStartingPurse(core), false, "a veteran who spent to zero is not a new game");
    assert.equal(veteran.pouch.money, 0, "…and is not paid again");

    // The other direction: away and back while the call is STILL in flight. The
    // gate re-arms, no second call starts, and the one in flight lifts it.
    loadedPF.save._briefCache.clear();
    loadedPF.save._generating.clear();
    let release2;
    const held2 = new Promise((resolve) => (release2 = resolve));
    responses.post = async () => {
      await held2;
      return { status: 200, body: { ok: true, data: gateBriefData } };
    };
    const metaC = { gameSetupConfig: { experienceConfig: { generate: true, seed: 33, theme: "cozy-village" } } };
    assert.equal(enter("chat-away-c", metaC), true, "C gates");
    void loadedPF.save.maybeGenerateBrief(core);
    await tick();
    const startedWith = postCount();
    enter("chat-away-b", metaB);
    assert.equal(enter("chat-away-c", metaC), true, "coming back mid-generation gates again");
    await loadedPF.save.maybeGenerateBrief(core);
    assert.equal(postCount(), startedWith, "without starting a second call");
    assert.equal(loadedPF.save.gate.state, "generating", "and the panel still says so");
    release2();
    for (let i = 0; i < 50 && loadedPF.save.gate; i++) await tick();
    assert.equal(loadedPF.save.gate, null, "the call already in flight lifts the gate it came back to");
    assert.equal(core.sim.world.brieved, true, "on the chat the player is actually looking at");
  });
});

// (as2) THE SESSION BRIEF CACHE DOES NOT EVICT A CORRECTNESS GUARD.
// The cache is load-bearing, not a speed-up: case (as) turns on "the session
// cache is the only thing that knows" — a generation that lands while the player
// is in another chat cannot patch the metadata blob they are holding. A plain
// drop-the-oldest ceiling therefore evicts the ONLY witness that a chat is
// sealed, and the next visit re-arms the gate, pays for a second host call, and
// hands the player a different world than the one already stored. Only entries
// the metadata has since been seen to carry are droppable.
{
  const S = loadedPF.save;
  S.reset();
  S._briefCache.clear();
  S._briefSeenInMeta.clear();
  const sealedFor = (seed) => brief.validate(gateBriefData, { theme: "cozy-village", seed });
  const generateMeta = { gameSetupConfig: { experienceConfig: { generate: true, seed: 1 } } };
  for (let i = 0; i < 12; i++) S._cacheBrief(`chat-cache-${i}`, sealedFor(i));
  assert.equal(S._briefCache.size, 12, "twelve chats sealed with the metadata still catching up: nothing is dropped");
  for (let i = 0; i < 12; i++) {
    assert.ok(S._configBrief(generateMeta, `chat-cache-${i}`), `chat-cache-${i} is still known to be sealed`);
    assert.equal(
      S.briefExpected(generateMeta, `chat-cache-${i}`),
      false,
      `…so revisiting chat-cache-${i} does not re-arm the gate and generate its world twice`,
    );
  }

  // …and once a chat's metadata comes back carrying the key, its cache entry has
  // stopped being the only witness and is the first thing eviction takes.
  const caughtUp = { ...generateMeta, pixelforgeBrief: sealedFor(3) };
  assert.ok(S._configBrief(caughtUp, "chat-cache-3"), "the metadata now carries chat-cache-3's brief itself");
  S._cacheBrief("chat-cache-new", sealedFor(99));
  assert.equal(S._briefCache.has("chat-cache-3"), false, "so THAT is the entry the ceiling reclaims");
  assert.equal(S._briefCache.size, 12, "…bringing the cache back under its bound");
  for (let i = 0; i < 12; i++) {
    if (i === 3) continue;
    assert.ok(S._briefCache.has(`chat-cache-${i}`), `and no unacknowledged entry was touched (chat-cache-${i})`);
  }
  // A metadata blob that does NOT carry the key marks nothing, even for a chat
  // the cache answers for — that is the whole distinction being drawn.
  assert.equal(S._briefSeenInMeta.has("chat-cache-4"), false, "the cache answering is not the metadata knowing");
  S._briefCache.clear();
  S._briefSeenInMeta.clear();
  S.reset();
}

// (at) #5406: THE WRITE ORDINAL, CONSUMED — AND EVERY FALLBACK PINNED.
// The engine now stamps experience rows and metadata keys from one per-chat
// counter (GET/PUT report `writeOrdinal`; metadata is mirrored at
// metadataWriteOrdinals[<key>]). It is better evidence INSIDE the rows that
// already arbitrate freshness, never a row of its own — so this case is half
// "the ordinal changes the verdict where it should" and half "and nowhere else".
{
  const ladder = (probe, ctx) =>
    loadedPF.save.classify(
      { failed: false, probe },
      { serverSerialized: null, localSerialized: '{"mine":1}', game: 1, now: Date.now(), ...ctx },
    );
  const row = (state, body) => ({ available: true, status: 200, body: { exists: true, state, ...body } });
  const differs = { v: 1, someone: "else" };

  // ── ROW 5: THE ORDINAL DISPROVES AN OWN-COMMIT SUSPICION ──
  // The gate is unchanged — a PUT of ours completed while this GET was in flight —
  // but _writeSeq cannot say WHICH row that PUT landed on, so the suspicion was
  // unfalsifiable and a current row was thrown away whenever a write overlapped a
  // read. A row at or past our own PUT's ordinal already carries that write.
  assert.equal(
    ladder(row(differs, { writeOrdinal: 12 }), { seqAtIssue: -1, putOrdinal: 12 }).row,
    6,
    "a row carrying our own last write is not a suspect — tie is the same write",
  );
  assert.equal(
    ladder(row(differs, { writeOrdinal: 13 }), { seqAtIssue: -1, putOrdinal: 12 }).row,
    6,
    "and neither is one past it",
  );
  assert.equal(
    ladder(row(differs, { writeOrdinal: 11 }), { seqAtIssue: -1, putOrdinal: 12 }).row,
    5,
    "a row BEHIND our own last write still is",
  );
  for (const [label, probe, ctx] of [
    ["a pre-#5406 engine sends no ordinal at all", row(differs), { seqAtIssue: -1, putOrdinal: 12 }],
    [
      "an engine that sends null for a legacy row",
      row(differs, { writeOrdinal: null }),
      { seqAtIssue: -1, putOrdinal: 12 },
    ],
    ["a row from before the feature, cloned", row(differs, { writeOrdinal: 0 }), { seqAtIssue: -1, putOrdinal: 12 }],
    ["a value that is not an ordinal", row(differs, { writeOrdinal: "12" }), { seqAtIssue: -1, putOrdinal: 12 }],
    ["and our own side missing", row(differs, { writeOrdinal: 12 }), { seqAtIssue: -1 }],
  ]) {
    assert.equal(ladder(probe, ctx).row, 5, `${label}: row 5 stands, byte-identically to before #5406`);
  }

  // ── ROWS 6/7/8: WHICH STORE IS LATER ──
  // The case #5406 was filed for (plan §5): a session that degraded to metadata
  // writes played on, the row store never saw any of it, and the next boot's
  // "the row wins" threw the whole session away.
  const stale = ladder(row(differs, { writeOrdinal: 40, anchorMatched: false }), { mirrorOrdinal: 57 });
  assert.equal(stale.row, 5, "a row strictly behind our metadata key's ordinal is the older store");
  assert.equal(stale.adopt, "ignore", "so boot does not rebuild onto it");
  assert.equal(stale.anchorCache, false, "and it never becomes the anchor");
  assert.equal(stale.flush, "proceed", "while our own newer world writes straight over it");
  assert.equal(stale.writeOrdinal, 40, "the ordinal rides on the decision for the caller to read");

  // THE ANCHOR OUTRANKS THE ORDINAL, and this is the assertion that says so. A
  // healthy flush ALWAYS leaves the mirror one ahead of the row it paired with
  // (the row is written first), so without this guard a swipe-back taken while
  // the tab was closed would stop rewinding the world — every boot would read
  // "metadata is newer" and refuse the row that IS the story's current point.
  assert.equal(
    ladder(row(differs, { writeOrdinal: 40, anchorMatched: true }), { mirrorOrdinal: 57 }).row,
    6,
    "a row that IS the visible anchor's own save is a timeline claim, and it still wins at adopt",
  );
  assert.equal(
    ladder(row(differs, { writeOrdinal: 57, anchorMatched: false }), { mirrorOrdinal: 57 }).row,
    6,
    "a tie is the same write, not an older one",
  );
  assert.equal(
    ladder(row(differs, { writeOrdinal: 90, anchorMatched: false }), { mirrorOrdinal: 57 }).row,
    6,
    "and a row AHEAD of the mirror is the newer store — which is what row 6 already does",
  );
  assert.equal(
    ladder(row(differs, { writeOrdinal: 40, anchorMatched: false }), {
      mirrorOrdinal: 57,
      serverSerialized: '{"was":1}',
    }).row,
    7,
    "with an anchor of our own the row store is already this session's authority — row 7 is untouched",
  );
  assert.equal(
    ladder(row(differs, { writeOrdinal: 40, anchorMatched: false }), { mirrorOrdinal: 57, anchorMoved: true }).row,
    7,
    "…and so is the anchor-moved path that forces it",
  );
  assert.equal(
    ladder(row({ mine: 1 }, { writeOrdinal: 40, anchorMatched: false }), { mirrorOrdinal: 57 }).row,
    8,
    "identical bytes are not a conflict to arbitrate, whatever the ordinals say",
  );
  for (const [label, body, ctx] of [
    ["no ordinal on the row", { anchorMatched: false }, { mirrorOrdinal: 57 }],
    ["no mirror (pre-#5406 metadata)", { writeOrdinal: 40, anchorMatched: false }, {}],
    ["a mirror clobbered to a non-number", { writeOrdinal: 40, anchorMatched: false }, { mirrorOrdinal: "57" }],
  ]) {
    assert.equal(ladder(row(differs, body), ctx).row, 6, `${label}: the byte ladder decides, exactly as before`);
  }

  // THE MIRROR IS READ OFF THE HOST'S METADATA, defensively at every hop.
  const mirrorOf = (chatMeta) => loadedPF.save._mirrorOrdinal({ host: { chatMeta } });
  assert.equal(mirrorOf({ metadataWriteOrdinals: { pixelforge: 57 } }), 57, "our key's entry");
  assert.equal(mirrorOf({ metadataWriteOrdinals: { gameMap: 57 } }), null, "somebody else's is not ours");
  assert.equal(
    mirrorOf({ metadataWriteOrdinals: { pixelforge: -1 } }),
    null,
    "and neither is a value the server would ignore",
  );
  for (const meta of [
    {},
    { metadataWriteOrdinals: null },
    { metadataWriteOrdinals: [] },
    { metadataWriteOrdinals: 4 },
  ]) {
    assert.equal(mirrorOf(meta), null, `a mirror shaped ${JSON.stringify(meta)} is simply unorderable`);
  }
  assert.equal(loadedPF.save._mirrorOrdinal(undefined), null, "…and so is no core at all");
}

// (at2) …DRIVEN: THE DEGRADED SESSION'S PLAY SURVIVES ITS NEXT BOOT.
// The §5 row this closes, end to end through adopt(): a previous session pinned
// to metadata mode wrote its play to the metadata key only, so the route row is
// an older world. Before #5406 "the route row always wins at adopt" (§Q2a) had no
// alternative and the session was lost with a toast.
await withSavePath(async ({ behavior, makeCore }) => {
  const core = makeCore("chat-degraded", 6161);
  core.sim.day = 30; // the play the degraded session did
  core.host.chatMeta = { metadataWriteOrdinals: { pixelforge: 57 } };
  const oursBefore = core.sim.world;
  // The row the last ROUTES-mode session left behind, two dozen ordinals ago, and
  // returned as the namespace's latest fallback rather than the reader's anchor.
  behavior.get = async () => ({
    available: true,
    status: 200,
    body: {
      exists: true,
      state: { v: 1, seed: 6161, theme: "cozy-village", zone: "inn", day: 4, player: { v: 1, game: 1 } },
      writeOrdinal: 33,
      anchorMatched: false,
    },
  });
  await loadedPF.save.adopt(core);
  assert.equal(loadedPF.save.mode, "routes", "the route is there and this is a routes-mode boot");
  assert.equal(core.sim.world, oursBefore, "but the older row does NOT replace the world we booted from metadata");
  assert.equal(core.sim.day, 30, "the degraded session's play is still here");
  assert.deepEqual(core.toasts, [], "and nothing announced a rewind that did not happen");
  assert.equal(loadedPF.save._serverSerialized, null, "the stale row never became the anchor");
  assert.equal(loadedPF.save._lastSerialized, null, "…and the next write is forced, so our world goes up over it");

  // The SAME row at the reader's own anchor is the opposite verdict: that is a
  // timeline claim, and §Q2a still hands it the world.
  loadedPF.save.reset();
  const swiped = makeCore("chat-degraded", 6161);
  swiped.sim.day = 30;
  swiped.host.chatMeta = { metadataWriteOrdinals: { pixelforge: 57 } };
  behavior.get = async () => ({
    available: true,
    status: 200,
    body: {
      exists: true,
      state: { v: 1, seed: 6161, theme: "cozy-village", zone: "inn", day: 4, player: { v: 1, game: 1 } },
      writeOrdinal: 33,
      anchorMatched: true,
    },
  });
  await loadedPF.save.adopt(swiped);
  assert.equal(swiped.sim.zoneId, "inn", "a swipe-back taken while the tab was closed still rewinds the world");
  assert.deepEqual(swiped.toasts, ["The world rewound with the story."], "and still says so");
});

// (at3) THE PUT ECHO CARRIES THE ORDINAL, AND IT IS PER-CHAT.
await withSavePath(async ({ behavior, makeCore }) => {
  loadedPF.save.mode = "routes";
  const core = makeCore("chat-putordinal", 7171);
  behavior.get = async () => ({ available: true, status: 200, body: { exists: false } });
  behavior.put = async () => ({ ok: true, id: "row1", anchor: { messageId: "m1", swipeIndex: 0 }, writeOrdinal: 88 });
  await loadedPF.save.flush(core, false);
  assert.equal(loadedPF.save._putOrdinal, 88, "the PUT's own ordinal is recorded off the echo");

  // An echo with no anchor in it still tells us the ordinal — the anchor guard
  // used to return before anything else on the echo could be read.
  behavior.put = async () => ({ ok: true, id: "row2", writeOrdinal: 89 });
  core.sim.day += 1;
  await loadedPF.save.flush(core, false);
  assert.equal(loadedPF.save._putOrdinal, 89, "…even when the route answered without one");

  behavior.put = async () => ({ ok: true, id: "row3" });
  core.sim.day += 1;
  await loadedPF.save.flush(core, false);
  assert.equal(loadedPF.save._putOrdinal, 89, "and a pre-#5406 echo leaves the last known ordinal alone");

  loadedPF.save.reset();
  assert.equal(loadedPF.save._putOrdinal, null, "it is per-chat, so the switch clears it");
});

// ═══ THINGS, MONEY, AND A BED (S5 slice 6 — S3 live, P1's field used) ══════

// (au) THE ITEM VOCABULARY IS COMPLETE, AND THE MONEY IS THEME-BEARING.
// 59-economy asserts completeness at load in the placers' idiom. This drives the
// same claim through the READERS, which is the half an assertion cannot make: a
// table that satisfies the registry check but renders as its own raw tag, or
// prices a colony in village coins, passes the assertion and fails here.
{
  const E = loadedPF.economy;
  for (const theme of loadedPF.art.themeIds()) {
    const w = { theme };
    const currency = E.currency(w);
    assert.ok(currency.one && currency.many, `${theme} names its money`);
    assert.equal(E.money(w, 1), `1 ${currency.one}`, `${theme} counts one of it`);
    assert.equal(E.money(w, 12), `12 ${currency.many}`, `${theme} counts twelve`);
    assert.equal(typeof E.price(w, "berth"), "number", `${theme} prices a berth`);
    for (const type of E.ITEM_TYPES) {
      const name = E.describe(w, { t: type, k: "" });
      assert.ok(name && name !== type, `${theme} has a NAME for "${type}", not the raw tag`);
    }
  }
  // Theme-bearing, or the vocabulary is a lookup table with one entry in it —
  // the same failure the maintainer named for name books ("Maud Thatch" in a
  // sci-fi colony), one layer down.
  const cozy = { theme: "cozy-village" };
  const scifi = { theme: "sci-fi-colony" };
  assert.notEqual(E.money(cozy, 5), E.money(scifi, 5), "a colony does not pay in a village's coins");
  assert.notEqual(
    E.describe(cozy, { t: "lodging-key" }),
    E.describe(scifi, { t: "lodging-key" }),
    "…nor carry a village's keys",
  );
  // `k` PREFIXES ON A TOOL AND NOWHERE ELSE, which is the 0.12 narrowing of a
  // rule that used to be general. It was written when `k` meant "quality" for
  // every row in the game; slice 2 scoped grading to TOOL_TYPES and slice 3
  // made the other vocabulary real, so a lodging key's `k` is a slug nobody has
  // claimed and prefixing it would read the same way "worms bait" does.
  assert.equal(E.describe(cozy, { t: "rod", k: "crude" }), "crude fishing rod", "a tool's tier reads in front of it");
  assert.equal(E.describe(cozy, { t: "lodging-key", k: "brass" }), "room key", "…and a non-tool's `k` does not");
  assert.equal(E.describe(cozy, { t: "star-chart" }), "star chart", "a type this build does not know still reads");
  assert.equal(E.describe(cozy, {}), "", "and a row with no type at all is nothing");
  assert.equal(E.money(cozy, -5), E.money(cozy, 0), "a negative purse is not a thing to render");
  // A save can name a theme this build dropped; that is a fallback, not a licence
  // for a live theme to ship unnamed (which is what the load assertion refuses).
  assert.equal(E.money({ theme: "retired-theme" }, 2), E.money(cozy, 2), "a dropped theme still renders");
  assert.equal(E.price(cozy, "a-thing-nobody-sells"), null, "and an unpriced thing is not for sale, not free");

  // …AND A THEME NAME OFF THE PROTOTYPE IS A DROPPED THEME LIKE ANY OTHER.
  // `theme` comes out of a save row, which is untrusted JSON: a plain
  // `SKINS[theme] ?? fallback` never reaches its fallback for "constructor" or
  // "toString" — the prototype answers with something non-nullish — and then
  // every economy call for that save TypeErrors on `.currency`. Own-property
  // only, exactly as price() and simFromSaved already read their own tables.
  for (const hostile of ["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf"]) {
    const w = { theme: hostile };
    assert.equal(E.money(w, 2), E.money(cozy, 2), `theme "${hostile}" renders as the fallback, not a crash`);
    assert.equal(E.currency(w).one, E.currency(cozy).one, `…and names its money`);
    assert.equal(E.price(w, "berth"), E.price(cozy, "berth"), `…and prices a berth`);
    assert.equal(E.describe(w, { t: "lodging-key" }), E.describe(cozy, { t: "lodging-key" }), `…and names its key`);
  }
  // The item map inside the skin is the same read, one level down: a pouch row's
  // type is save data too, and `items["constructor"]` is a function whose `.name`
  // is "Object" — a key the player never had, rendered as one they did.
  assert.equal(E.describe(cozy, { t: "constructor" }), "constructor", "an item type off the prototype reads as itself");
  assert.equal(E.describe(cozy, { t: "toString" }), "toString", "…whatever it is called");
  // A save can even carry a hostile theme through a real world build.
  const hostileSim = new loadedPF.Sim(world.build(4242, "cozy-village"));
  hostileSim.world.theme = "constructor";
  const hostileCore = { chatId: "chat-proto-theme", sim: hostileSim, hud: { toast() {}, refreshChips() {} } };
  assert.equal(
    loadedPF.economy.berthOffer(hostileCore).reason,
    "no-keeper",
    "and the berth offer answers rather than throwing",
  );
}

// ── THE THEME ID ITSELF IS RESOLVED AS AN OWN PROPERTY (#515) ─────────────────
// The UPSTREAM half of the case directly above, and the reason a save row can
// carry a prototype-named theme at all. `THEMES[id]` was bare, so "constructor"
// came back a truthy FUNCTION, was accepted as a theme id, and was PINNED into
// the module's `activeTheme` — the one thing setTheme's own docstring has always
// promised an unknown id cannot do. From there it reaches world.theme, the save
// row, and every theme-keyed table downstream of both.
{
  try {
    for (const id of ["constructor", "__proto__", "toString", "valueOf", "hasOwnProperty"]) {
      loadedPF.art.setTheme("cozy-village");
      assert.equal(loadedPF.art.setTheme(id), "cozy-village", `"${id}" is not a theme, whatever the prototype answers`);
      assert.equal(loadedPF.art.theme, "cozy-village", `…and it is not left pinned as the active one`);
    }
    // Not a blanket refusal of anything unfamiliar: the themes this build really
    // ships still resolve to themselves, and an ordinary dropped one still lands
    // on the default, which is the behaviour the docstring describes.
    for (const id of loadedPF.art.themeIds()) {
      assert.equal(loadedPF.art.setTheme(id), id, `"${id}" is a theme this build ships and still resolves to itself`);
    }
    assert.equal(loadedPF.art.setTheme("retired-theme"), "cozy-village", "and a theme this build dropped falls back");
  } finally {
    loadedPF.art.setTheme("cozy-village");
  }
}

// ── THE WORKED EXAMPLE IS PICKED THE SAME WAY (#515, found by the sweep) ──────
// defaults() reads DEFAULT_BRIEFS by the theme it is HANDED, before validate()
// applies the whitelist one screen down, and it is exported — so the word comes
// from wherever the caller got it. Bare, `defaults("__proto__")` handed
// Object.prototype in as the worked example; it is an object, so it survived
// validate()'s transport check, and every field then floored to nothing. The
// brief came back themed cozy-village and EMPTY: the fallback on that line
// reading as though it had fired when it had not.
{
  const cozy = JSON.stringify(brief.defaults("cozy-village", 5));
  assert.equal(JSON.stringify(brief.defaults("retired-theme", 5)), cozy, "an unknown theme gets the default's brief");
  for (const hostile of ["constructor", "__proto__", "toString", "valueOf", "hasOwnProperty"]) {
    // The SAME brief, not merely a non-empty one: a prototype-named theme is a
    // theme this build does not ship, and gets exactly what any other gets.
    assert.equal(JSON.stringify(brief.defaults(hostile, 5)), cozy, `"${hostile}" gets it too, whole rather than empty`);
  }
  const scifi = brief.defaults("sci-fi-colony", 5);
  assert.equal(scifi.theme, "sci-fi-colony", "and a theme this build does ship still gets its own worked example");
  assert.ok(scifi.features.length > 0, "…with the features that example is written to carry");
}

// ── …AND A WHOLE COMPILED SETTLEMENT IS NOT LOST TO ONE (#515) ────────────────
// The name book was the `??`-never-reaches-fallback shape: read bare,
// RESIDENT_NAMES["__proto__"] is Object.prototype, `??` keeps it because it is
// not nullish, and the first `nameBook.family[…]` throws — into build()'s catch,
// which degrades to the LEGACY three-zone world. Silently, which is the part
// worth a case: the only tell a player gets is that the settlement their brief
// describes in eighteen zones comes back as three.
//
// Staged through the SEALED BRIEF's theme rather than through setTheme, with the
// guard one file up removed for the length of the build. The point of the line
// is that the name-book read stands on its own — not that the module above it
// happens to keep hostile words away from it today.
{
  const realSetTheme = loadedPF.art.setTheme;
  try {
    const honest = world.build(4242, "cozy-village", brief.defaults("cozy-village", 4242));
    assert.equal(honest.brieved, true, "the control is a compiled world and not a degraded one");
    for (const hostile of ["constructor", "__proto__", "toString", "valueOf"]) {
      const sealed = brief.defaults("cozy-village", 4242);
      sealed.theme = hostile;
      loadedPF.art.setTheme = null;
      const w = world.build(4242, hostile, sealed);
      loadedPF.art.setTheme = realSetTheme;
      assert.equal(w.brieved, true, `a brief themed "${hostile}" COMPILES rather than degrading to the legacy world`);
      assert.equal(Object.keys(w.zones).length, Object.keys(honest.zones).length, "…to its full zone count");
      // And the fallback the line documents actually FIRED, rather than the read
      // merely not throwing: the residents the compiler mints come back with the
      // default book's names, byte for byte the ones the honest world minted.
      assert.ok(w.minted.length > 0, "…with residents minted at all");
      assert.deepEqual(w.minted, honest.minted, "…and named out of the book the fallback names");
      assert.equal(w.mintStamp, honest.mintStamp, "…down to the stamp that travels with them");
    }
  } finally {
    loadedPF.art.setTheme = realSetTheme;
    loadedPF.art.setTheme("cozy-village");
  }
}

// ── AND THE ROW THAT CARRIED ONE LOADS INTO THE DEFAULT WORLD (#515) ──────────
// The chain end to end, through the real load path. A save row's `theme` is
// untrusted JSON, simFromSaved hands it straight to world.build, and before the
// guard it came back out AS world.theme — with the legacy layout's own name book
// read off that same string, so every zone in the restored world was a place
// with no name. The flush afterwards then wrote the hostile theme back down.
{
  try {
    for (const hostile of ["constructor", "__proto__", "toString"]) {
      const row = JSON.parse(`{"v":1,"seed":1234,"theme":${JSON.stringify(hostile)}}`);
      const sim = loadedPF.save.simFromSaved(row, {}, "chat-proto-theme-515");
      assert.equal(sim.world.theme, "cozy-village", `a row themed "${hostile}" restores the DEFAULT theme's world`);
      assert.equal(loadedPF.art.theme, "cozy-village", "…and nothing was pinned to it on the way through");
      for (const zone of Object.values(sim.world.zones)) {
        assert.ok(typeof zone.name === "string" && zone.name.trim(), `…and ${zone.id} is a place with a name`);
      }
      // The row HEALS rather than round-tripping: the next flush writes back the
      // theme the world it restored really has.
      const snap = loadedPF.save.snapshot({ sim, chatId: "chat-proto-theme-515" });
      assert.equal(snap.theme, "cozy-village", "…and the next write puts an honest theme back in the row");
    }
  } finally {
    loadedPF.art.setTheme("cozy-village");
  }
}

// ── THE ZONE A MOUNT LANDS IN IS AN OWN PROPERTY TOO (#567) ───────────────────
// The same read on the WRITE side. `teleport` gated on a bare
// `!this.world.zones[zoneId]`, and `zones["constructor"]` is a truthy FUNCTION,
// so the early return did not fire: `zoneId` was pinned to a word no zone
// answers to and `zone()` handed Object's own constructor to everything
// downstream of the mount. Nothing catches that — the first `z.w` or `z.solid`
// off it throws inside the frame loop, on a sim the player is standing in.
// Latent only because both shipped callers pre-validate their id; `teleport` is
// public on PF.Sim, and 60-save already spells this exact test out as `hasZone`
// for the untrusted ids it takes off a save row.
{
  const sim = new loadedPF.Sim(world.build(9001, "cozy-village"));
  const before = { zoneId: sim.zoneId, x: sim.x, y: sim.y };
  for (const hostile of ["constructor", "__proto__", "toString", "valueOf", "hasOwnProperty"]) {
    sim.dirty = false;
    sim.teleport(hostile, 3, 3);
    assert.equal(sim.zoneId, before.zoneId, `"${hostile}" is not a zone, whatever the prototype answers`);
    assert.equal(sim.x, before.x, "…so the mount refuses and the player never moved");
    assert.equal(sim.y, before.y, "…on either axis");
    assert.equal(sim.dirty, false, "…and a mount that did not happen marks nothing save-worthy");
    // The refusal is CLEAN, not merely early: the sim keeps stepping instead of
    // throwing the first time the loop reads a width off a builtin.
    assert.ok(sim.zone() && typeof sim.zone().w === "number", "…and zone() still answers with a real zone");
    sim.step(1 / 60, {});
  }
  // Not a blanket refusal of anything unfamiliar: a real zone id still mounts,
  // and an ordinary id this world does not have is refused exactly as before.
  const inn = sim.world.zones.inn;
  sim.teleport("inn", inn.spawn.x, inn.spawn.y);
  assert.equal(sim.zoneId, "inn", "an honest zone id still mounts");
  assert.equal(sim.x, (inn.spawn.x + 0.5) * loadedPF.TILE, "…at the tile it was handed");
  sim.teleport("no-such-zone", 1, 1);
  assert.equal(sim.zoneId, "inn", "and an honest id this world does not have is still refused");
}

// (av) THE BERTH: S3'S FIRST MONEY SINK AND P1'S BED, IN ONE TRANSACTION.
// The plan's chosen vertical (§2, Decisions #2): there is no automatic home, so
// the player-driven path to a bed is renting a room — which is also the first
// thing money has ever been for. Every effect goes through a shipped mutator, and
// the interesting half of the contract is the REFUSALS: award() floors at zero
// rather than refusing, so an unaffordable rental that still ran would silently
// give away a room for nothing.
{
  const E = loadedPF.economy;
  const P = loadedPF.player;
  const sealed = brief.validate(
    {
      scale: "village",
      name: "Fallowmere",
      prosperity: "modest",
      backgroundPopulation: 40,
      situation: "The bridge went in the spring flood and the ford is the only way across.",
      cast: [
        { name: "Perrin Quill", role: "innkeep", kind: "host", tint: "amber", home: "Fallowmere", household: 1 },
        { name: "Wren Ash", role: "miller", kind: "maker", tint: "teal", home: "Fallowmere", household: 2 },
      ],
    },
    { theme: "cozy-village", seed: 8080 },
  );
  const w = world.build(8080, "cozy-village", sealed);
  const sim = new loadedPF.Sim(w);
  const core = { chatId: "chat-berth", sim, hud: { toast() {}, refreshChips() {} } };

  let keeper = null;
  let keeperZone = null;
  let bystander = null;
  for (const zoneId of Object.keys(w.zones)) {
    for (const npc of w.zones[zoneId].npcs) {
      if (typeof npc.lodging === "string" && !keeper) {
        keeper = npc;
        keeperZone = zoneId;
      } else if (!npc.lodging && !bystander) bystander = npc;
    }
  }
  assert.ok(keeper, "the compiled world has somebody who lets rooms");
  assert.equal(w.zones[keeper.lodging]?.lodging, true, "and the room they let is the settlement's gathering");
  assert.ok(!/^h\d+$/.test(keeper.lodging), "whose id is a sealed anchor — setHome refuses a minted h{n} outright");
  assert.ok(bystander, "…and somebody who does not");

  // Proximity is 30-sim's own concern and pinned there; what the offer is ABOUT
  // is "a lodging keeper within reach", and nearNpc IS that. Supplied, not walked.
  const stand = (zoneId, npc) => {
    sim.zoneId = zoneId;
    sim.nearNpc = npc;
  };

  assert.equal(E.berthOffer(core).price, null, "nobody within reach quotes no price");
  // OUTSIDE the room, deliberately. Standing IN it is an offer whoever you happen
  // to be nearest to — the room path, pinned in case (ay) — so the fact this line
  // is about (a villager is not a keeper) has to be asked where the room is not
  // also answering.
  stand(w.startZone, bystander);
  assert.equal(E.berthOffer(core).price, null, "and a villager who keeps no rooms lets none");

  // THE KEEPER, AND AN EMPTY PURSE. The price is quoted anyway: a refusal the
  // player cannot read is a control that just does not work.
  stand(keeperZone, keeper);
  const broke = E.berthOffer(core);
  assert.equal(broke.available, false, "an empty purse cannot take the room");
  assert.equal(broke.reason, "cannot-afford", "and says why");
  assert.equal(broke.price, E.price(w, "berth"), "while still quoting the price");
  assert.equal(E.rentBerth(core).ok, false, "the rental refuses");
  // THE OTHER HALF OF THAT CONTRACT, said out loud: award() FLOORS rather than
  // refusing, which is precisely why the affordability check is the caller's job.
  // A sink that skipped it would not fail — it would silently hand over the room
  // and stop the purse at zero, which reads as a working feature.
  assert.deepEqual(P.award(core, { money: -999 }), { money: 0, level: null }, "an overdraw floors at zero");
  assert.equal(P.get(core).pouch.money, 0, "…and no further: money never goes negative");
  const nothing = P.get(core);
  assert.equal(nothing.pouch.money, 0, "taking nothing");
  assert.equal(nothing.home, null, "and giving nothing");
  assert.deepEqual(nothing.pouch.items, [], "no key");
  assert.deepEqual(nothing.ledger.lines, [], "no line");
  assert.deepEqual(nothing.rel, {}, "and nobody remembers a sale that did not happen");

  // WITH MONEY: the whole vertical, one shipped verb per effect.
  P.award(core, { money: 100 });
  const offer = E.berthOffer(core);
  assert.equal(offer.available, true, "the offer stands");
  assert.equal(E.rentBerth(core).ok, true, "and it is taken");
  const now = P.get(core);
  assert.equal(now.pouch.money, 100 - offer.price, "the purse paid, exactly once");
  assert.equal(now.home, keeper.lodging, "P1's field holds the room, by its sealed id");
  assert.deepEqual(
    now.pouch.items,
    [{ t: "lodging-key", q: 1, k: "" }],
    "the key is the receipt, and the pouch's first real row",
  );
  assert.equal(now.ledger.lines.length, 1, "one ledger line, for the day boundary P5 will summarise");
  assert.ok(now.ledger.lines[0][1].includes(E.money(w, offer.price)), "…naming the price in this world's own money");
  const rel = now.rel[w.startZone];
  assert.ok(rel && rel[keeper.name], "and the keeper remembers — SETTLEMENT-scoped, per plan §2");
  assert.equal(rel[keeper.name].t, 1, "one encounter");
  assert.ok(rel[keeper.name].s, "with the line that says what it was");
  assert.equal(Object.keys(now.rel).length, 1, "exactly one zone holds rel rows: the settlement, not the room");

  // AND NOT TWICE. The same room sold again is not a second room.
  const again = E.berthOffer(core);
  assert.equal(again.available, false, "the room is already theirs");
  assert.equal(again.reason, "already-yours", "and says so");
  assert.equal(E.rentBerth(core).ok, false, "so it is not sold again");
  assert.equal(P.get(core).pouch.money, 100 - offer.price, "and the purse is untouched by the refusal");

  // Everything the rental wrote is a shipped field, so it round-trips byte-stably.
  const wire = JSON.stringify(P.serialize(P.get(core)));
  assert.equal(JSON.stringify(P.serialize(P.parse(JSON.parse(wire)).player)), wire, "the block round-trips unchanged");

  // THE LEGACY WORLD LETS ROOMS TOO — the three-zone village has always had an
  // inn and an innkeeper, and a pre-0.4.0 save is exactly the chat the loading
  // gate never touches.
  const legacy = new loadedPF.Sim(world.build(9001, "cozy-village"));
  const lcore = { chatId: "chat-berth-legacy", sim: legacy, hud: { toast() {}, refreshChips() {} } };
  legacy.zoneId = "inn";
  legacy.nearNpc = legacy.world.zones.inn.npcs.find((npc) => npc.name === "Mira");
  P.award(lcore, { money: 50 });
  assert.equal(E.rentBerth(lcore).ok, true, "the legacy inn lets a berth as well");
  assert.equal(P.get(lcore).home, "inn", "anchored at the inn zone");
  assert.ok(P.get(lcore).rel.village?.Mira, "and Mira remembers it, in the settlement's own zone");

  // A LODGING ZONE ALWAYS HAS A KEEPER — both marks or neither. The compiler
  // resolves the gathering's host from the building's owner, and that resolution
  // can come back null (a brief with no `host` kind and nobody homed in that
  // building). The zone mark used to go up regardless: a room the world calls
  // lodging with nobody behind the counter, which is a promise the offer can
  // never keep and a berth button that quotes a price nobody will take.
  const lodgingWorlds = [
    ["legacy", world.build(9001, "cozy-village")],
    ["the compiled village", w],
  ];
  for (const theme of loadedPF.art.themeIds()) {
    for (const seed of [1, 77, 8080, 424242]) {
      lodgingWorlds.push([`${theme}/${seed}`, world.build(seed, theme, brief.defaults(theme, seed))]);
    }
  }
  // The pointed one: a brief that SEALS a gathering and homes nobody in it — no
  // `host` kind in the cast and nobody living at that address — so the owner
  // resolution comes back null and there is genuinely nobody behind the counter.
  const hostless = brief.validate(
    {
      scale: "village",
      name: "Nowhere",
      places: [{ kind: "gathering", name: "The Wet Boot", flavor: "" }],
      cast: [
        { name: "Ivo Reed", role: "miller", kind: "maker", tint: "teal", home: "Nowhere", household: 1 },
        { name: "Sela Reed", role: "farmhand", kind: "grower", tint: "green", home: "Nowhere", household: 2 },
        { name: "Bram", role: "carter", kind: "maker", tint: "amber", home: "Nowhere", household: 3 },
        { name: "Odi", role: "child", kind: "child", tint: "rose", home: "Nowhere", household: 3 },
      ],
    },
    { theme: "cozy-village", seed: 606 },
  );
  lodgingWorlds.push(["a brief that homes no host", world.build(606, "cozy-village", hostless)]);
  for (const [label, lw] of lodgingWorlds) {
    const keepers = [];
    for (const zoneId of Object.keys(lw.zones)) {
      for (const npc of lw.zones[zoneId].npcs) if (typeof npc.lodging === "string" && npc.lodging) keepers.push(npc);
    }
    for (const zoneId of Object.keys(lw.zones)) {
      if (lw.zones[zoneId].lodging !== true) continue;
      assert.ok(
        keepers.some((npc) => npc.lodging === zoneId),
        `${label}: a zone marked lodging has somebody letting it`,
      );
    }
    for (const npc of keepers) {
      assert.equal(lw.zones[npc.lodging]?.lodging, true, `${label}: a keeper's room is marked lodging`);
    }
  }
  // …and a hostless world compiles a berth button that simply is not there,
  // rather than a counter with nobody behind it.
  const hostlessWorld = world.build(606, "cozy-village", hostless);
  const hostlessSim = new loadedPF.Sim(hostlessWorld);
  const hcore = { chatId: "chat-hostless", sim: hostlessSim, hud: { toast() {}, refreshChips() {} } };
  P.award(hcore, { money: 100 });
  for (const zoneId of Object.keys(hostlessWorld.zones)) {
    for (const npc of hostlessWorld.zones[zoneId].npcs) {
      hostlessSim.zoneId = zoneId;
      hostlessSim.nearNpc = npc;
      const offer = E.berthOffer(hcore);
      assert.equal(offer.available, false, "nobody in a hostless world lets a room");
      assert.equal(offer.price, null, "…so no price is ever quoted, which is what hides the button");
    }
  }
  loadedPF.save.reset();
}

// (aw) THE STARTING PURSE IS ONE-SHOT, AND IT IS NOT A DEFAULT.
// It cannot be a default on the block: serialize() emits every field
// unconditionally, so a non-zero default would move the bytes of every save in
// the wild and re-write every open chat on first load. It is granted at the seal
// instead, and the emptiness test is what keeps the pre-gate interim shim — where
// a block with a real session in it crosses the same seam — from being paid.
{
  const E = loadedPF.economy;
  const P = loadedPF.player;
  const sim = new loadedPF.Sim(world.build(4321, "cozy-village"));
  const core = { chatId: "chat-purse", sim, hud: { toast() {}, refreshChips() {} } };
  assert.equal(P.get(core).pouch.money, 0, "a block still boots with an empty purse — the frozen wire literal says so");
  assert.equal(E.grantStartingPurse(core), true, "a world sealing onto an untouched block pays it out");
  assert.equal(P.get(core).pouch.money, E.STARTING_PURSE, "…in full");
  assert.equal(P.get(core).ledger.lines.length, 1, "with a line saying so");
  assert.equal(E.grantStartingPurse(core), false, "and never again on the same block");
  assert.equal(P.get(core).pouch.money, E.STARTING_PURSE, "so the purse cannot double");

  for (const [label, seed, play] of [
    ["a pouch with something already in it", 4322, (c) => P.grant(c, "apple", 1)],
    ["a purse with something already in it", 4323, (c) => P.award(c, { money: 3 })],
    ["a ledger with a day in it", 4324, (c) => P.log(c, "something happened", 1)],
    ["a player who already has a home", 4325, (c) => P.setHome(c, "inn")],
  ]) {
    const played = new loadedPF.Sim(world.build(seed, "cozy-village"));
    const pcore = { chatId: `chat-purse-${seed}`, sim: played, hud: { toast() {}, refreshChips() {} } };
    play(pcore);
    assert.equal(E.grantStartingPurse(pcore), false, `${label} is not a new game`);
    assert.ok(P.get(pcore).pouch.money < E.STARTING_PURSE, "…and is not paid");
  }
  loadedPF.save.reset();
}

// (ax) THE ROW SAYS WHICH WIRE ERA IT IS, OUT OF BAND (S5 slice 8).
// #5102's PUT has always accepted a `schemaVersion` (int 1..1,000,000, default 1)
// and this package sent none, so every row it has ever written claims era 1
// whatever is inside it. The column exists so a future build — or a tool reading
// an export — can tell a row's wire era WITHOUT parsing the state, and that only
// works if somebody fills it in.
//
// It is a MIRROR and never the authority, which is the other half of every
// assertion here. The block's own `player.v` travels with the bytes it describes;
// the column travels with the ROW, and a row can be cloned to another anchor,
// hand-edited, or written by something that never paired the two. So: the PUT
// carries the current version, the state string does not move, and the read still
// resolves by `v`.
{
  // ── THE WIRE ITSELF ──────────────────────────────────────────────────────────
  // The harness stubs PF.api everywhere else, so this is the one place the actual
  // request body can be read back.
  const realFetch = globalThis.fetch;
  const bodies = [];
  globalThis.fetch = async (url, init) => {
    bodies.push(JSON.parse(init.body));
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
  try {
    await loadedPF.api.putExperienceState("chat-sv", { v: 1, player: { v: 3 } }, false, 3);
    assert.deepEqual(
      bodies.at(-1),
      { state: { v: 1, player: { v: 3 } }, schemaVersion: 3 },
      "the PUT names the row's era beside the state",
    );
    await loadedPF.api.putExperienceState("chat-sv", { v: 1 }, false);
    assert.deepEqual(
      bodies.at(-1),
      { state: { v: 1 } },
      "…and a caller that names none sends exactly the bytes it always did",
    );
    // A DIAGNOSTIC FIELD MUST NEVER BE ABLE TO KILL THE WRITE. The route's schema
    // 400s on anything outside its own bounds, so a value it would refuse is
    // dropped here and the row takes the route's default instead of the save
    // failing over a column nothing reads for correctness.
    for (const bad of [0, -1, 1.5, "2", null, NaN, 1_000_001, Number.MAX_SAFE_INTEGER + 2]) {
      await loadedPF.api.putExperienceState("chat-sv", { v: 1 }, false, bad);
      assert.deepEqual(bodies.at(-1), { state: { v: 1 } }, `a schemaVersion of ${String(bad)} is omitted, not sent`);
    }
  } finally {
    globalThis.fetch = realFetch;
  }
}

// ── BOTH WRITE PATHS CARRY IT, AND NEITHER MOVES THE STATE ────────────────────
await withSavePath(async ({ calls, behavior, makeCore }) => {
  loadedPF.save.mode = "routes";
  const core = makeCore("chat-sv-flush", 8181);
  behavior.get = async () => ({ available: true, status: 200, body: { exists: false } });
  await loadedPF.save.flush(core, false);
  const put = calls.find((c) => c.kind === "put");
  assert.ok(put, "the ordinary flush wrote the row");
  assert.equal(put.schemaVersion, loadedPF.player.currentV(), "carrying this build's block version");
  // THE STATE STRING IS UNTOUCHED. The row's bytes are the interface every dedupe
  // compares; this is a sibling FIELD on the PUT body, not a field in the state.
  assert.equal(
    JSON.stringify(put.state),
    JSON.stringify(loadedPF.save.snapshot(core)),
    "…and the state it sent is the snapshot, byte for byte",
  );
  assert.equal("schemaVersion" in put.state, false, "the era rides the ROW, never the block's own bytes");

  // The pagehide pair builds its own snapshot and would have been the one path to
  // forget.
  core.sim.day += 1;
  calls.length = 0;
  loadedPF.save.flushTeardown(core);
  const tearPut = calls.find((c) => c.kind === "put");
  assert.ok(tearPut && tearPut.keepalive === true, "the teardown PUT went out on the keepalive path");
  assert.equal(tearPut.schemaVersion, loadedPF.player.currentV(), "…with the same era on it");
});

// ── THE COLUMN CORROBORATES; `v` DECIDES ──────────────────────────────────────
// One migration step in the table, so "the current era" and "era 1" are different
// numbers and the two can actually disagree.
{
  const P = loadedPF.player;
  const before = P.MIGRATIONS.length;
  // A step with a visible effect and no new key, so "did the ladder run?" is a
  // readable question and the carry is not involved in the answer.
  P.MIGRATIONS.push((block) => ({ ...block, flushedDay: 99 }));
  try {
    assert.equal(P.currentV(), 2, "with one step in the table this build writes v2");

    // A LEGACY ROW: the column says era 1 — the route's default, which is what
    // every row written before this slice claims — while the block inside says v2.
    await withSavePath(async ({ behavior, makeCore }) => {
      const core = makeCore("chat-sv-legacy", 8282);
      behavior.get = async () => ({
        available: true,
        status: 200,
        body: {
          exists: true,
          schemaVersion: 1,
          state: {
            v: 1,
            seed: 8282,
            theme: "cozy-village",
            player: { v: 2, game: 1, pouch: { money: 7, items: [] } },
          },
        },
      });
      const warned = [];
      const realWarn = globalThis.console.warn;
      globalThis.console.warn = (...args) => warned.push(args.map(String).join(" "));
      try {
        await loadedPF.save.adopt(core);
      } finally {
        globalThis.console.warn = realWarn;
      }
      assert.equal(core.sim.player.v, 2, "the BLOCK's own v decided the read, not the row's column");
      assert.equal(core.sim.player.pouch.money, 7, "so the block came through whole");
      assert.equal(core.sim.player.flushedDay, 0, "and the v1→v2 step did not run over a block already at v2");
      assert.equal(
        warned.filter((w) => w.includes("schemaVersion")).length,
        1,
        "the disagreement is worth saying, once, and it says which side wins",
      );
      assert.equal(loadedPF.quarantine.peek("migration"), null, "nothing was quarantined over a column");
    });

    // …AND THE OTHER DIRECTION: a column claiming an era this build has never
    // written, over a block that honestly declares v1. The in-band ladder migrates
    // it; the too-new gate reads `v` and never the column, so nothing is parked.
    await withSavePath(async ({ behavior, makeCore }) => {
      const core = makeCore("chat-sv-ahead", 8383);
      behavior.get = async () => ({
        available: true,
        status: 200,
        body: {
          exists: true,
          schemaVersion: 5,
          state: {
            v: 1,
            seed: 8383,
            theme: "cozy-village",
            player: { v: 1, game: 1, pouch: { money: 3, items: [] } },
          },
        },
      });
      await loadedPF.save.adopt(core);
      assert.equal(core.sim.player.v, 2, "a v1 block is migrated to this build's version");
      assert.equal(core.sim.player.flushedDay, 99, "…by the step the in-band ladder ran");
      assert.equal(core.sim.player.pouch.money, 3, "carrying what it held");
      assert.equal(loadedPF.quarantine.peek("version"), null, "and a column ahead of us is not a too-new BLOCK");
    });
  } finally {
    P.MIGRATIONS.length = before;
  }
}

// (ay) THE BERTH IS OFFERED BY THE ROOM AS WELL AS BY THE PERSON.
// Second live playtest: the maintainer stood INSIDE The Amber Hearth with Mira a
// few tiles off and had no berth button anywhere — Talk, Wait and Keyboard and
// nothing else. Nothing was wrong with the compile, and the assertions below
// re-state that against the playtest's own shape: the gathering carried its
// lodging mark and the host carried the keeper mark that pairs with it.
//
// The offer keyed on `sim.nearNpc` ALONE, and nearNpc is the single NEAREST NPC
// within 26px — a tile and a half. So the room could be the settlement's only
// inn, the keeper could be standing in it, and the button was still hidden
// because the player was closer to the guard by the door. Every berth case
// written before this one SUPPLIED nearNpc, which is exactly why none of them
// could see it.
//
// The offer still follows the PERSON — an innkeeper standing in the square at
// noon can let you a room, and that is the whole reason the mark is on the NPC.
// It now also follows the ROOM: standing in a zone the compiler marked lodging,
// with somebody in that zone who lets it, is an offer. Nobody in the room is
// still nobody: an empty inn quotes no price.
{
  const E = loadedPF.economy;
  const P = loadedPF.player;
  // The playtest's shape: a DECLARED gathering, a `host` who is homed in it, and
  // a second cast member under the same roof to stand between them.
  const sealed = brief.validate(
    {
      scale: "village",
      name: "Hearthvale",
      prosperity: "modest",
      backgroundPopulation: 40,
      situation: "Pumpkins keep going missing from the fair field.",
      places: [{ kind: "gathering", name: "The Amber Hearth", flavor: "A honey-lit inn." }],
      cast: [
        { name: "Mira", role: "Innkeeper", kind: "host", tint: "amber", home: "The Amber Hearth", household: 1 },
        { name: "Rook", role: "Guard Captain", kind: "guard", tint: "blue", home: "The Amber Hearth", household: 1 },
        { name: "Tam", role: "Farmer", kind: "grower", tint: "green", home: "Hearthvale", household: 2 },
      ],
    },
    { theme: "cozy-village", seed: 2095930824 },
  );
  const w = world.build(2095930824, "cozy-village", sealed);
  const gid = Object.entries(sealed._ids.zones).find(([, name]) => name === "The Amber Hearth")?.[0];
  assert.ok(gid && w.zones[gid], "the declared gathering compiled to a room");
  assert.equal(w.zones[gid].lodging, true, "which carries the lodging mark");
  const keeper = w.zones[gid].npcs.find((npc) => npc.lodging === gid);
  assert.ok(keeper, "and the host is standing in it, carrying the mark that pairs with it");
  assert.equal(keeper.name, "Mira", "…the host the brief named");
  const roommate = w.zones[gid].npcs.find((npc) => !npc.lodging);
  assert.ok(roommate, "with somebody else in the room to be nearer to");

  const sim = new loadedPF.Sim(w);
  const core = { chatId: "chat-berth-room", sim, hud: { toast() {}, refreshChips() {} } };
  P.award(core, { money: 100 });
  const stand = (zoneId, npc) => {
    sim.zoneId = zoneId;
    sim.nearNpc = npc ?? null;
    return E.berthOffer(core);
  };

  // THE PLAYTEST, EXACTLY: in the room, nobody within arm's reach.
  const alone = stand(gid, null);
  assert.equal(alone.available, true, "standing in the inn is an offer even with nobody within reach");
  assert.equal(alone.zoneId, gid, "…of that room");
  assert.equal(alone.keeper?.name, "Mira", "…from the keeper who is in it");
  assert.equal(alone.price, E.price(w, "berth"), "…at the price the button quotes");

  // AND WITH THE GUARD BY THE DOOR WINNING nearNpc. This is the reported frame.
  const crowded = stand(gid, roommate);
  assert.equal(crowded.available, true, "being nearer to a bystander does not close the inn");
  assert.equal(crowded.keeper?.name, "Mira", "…the keeper still answers for the room");

  // THE PERSON PATH IS UNTOUCHED: the keeper out in the square still lets a room.
  const square = stand(w.startZone, keeper);
  assert.equal(square.available, true, "an innkeeper in the square at noon can still let you a room");
  assert.equal(square.zoneId, gid, "…the room being the one they keep, not the one you are in");

  // AND THE SQUARE ITSELF IS NOT AN INN.
  assert.equal(
    stand(w.startZone, null).price,
    null,
    "standing outside quotes no price, which is what hides the button",
  );
  assert.equal(stand(w.startZone, roommate).price, null, "and a villager who keeps no rooms lets none");

  // AN EMPTY ROOM IS NOBODY. This is the state resolveSchedules leaves when a
  // daypart moves the keeper out (it splices NPCs between `zone.npcs` arrays),
  // so it is a real frame and not a hypothetical one.
  const room = w.zones[gid];
  const held = room.npcs.splice(room.npcs.indexOf(keeper), 1)[0];
  assert.equal(stand(gid, null).price, null, "an inn with nobody behind the counter quotes no price");
  assert.equal(stand(gid, null).reason, "no-keeper", "…and says so");
  room.npcs.push(held);

  // THE REFUSALS REACH THE ROOM PATH TOO — a control that vanishes when the
  // purse runs short teaches the player nothing about the price.
  P.award(core, { money: -100 });
  const broke = stand(gid, null);
  assert.equal(broke.available, false, "an empty purse still cannot take the room");
  assert.equal(broke.reason, "cannot-afford", "and says why");
  assert.equal(broke.price, E.price(w, "berth"), "while still quoting the price, so the button stays on screen");
  P.award(core, { money: 100 });
  assert.equal(E.rentBerth(core).ok, true, "the room is taken from inside the room");
  assert.equal(P.get(core).home, gid, "anchored at the gathering's sealed id");
  const owned = stand(gid, null);
  assert.equal(owned.available, false, "and the same room is not sold twice");
  assert.equal(owned.reason, "already-yours", "…it is simply yours");
  assert.equal(owned.price, E.price(w, "berth"), "…still on screen, saying so");

  // BOTH MARKS OR NEITHER, AND THE HOSTLESS FIXTURE STILL REFUSES.
  // The room path can only ever find a keeper through the zone mark, so a brief
  // that seals a gathering and homes nobody in it must still compile no mark at
  // all — otherwise the new path is the very "counter with nobody behind it"
  // the old one was fixed for.
  const hostless = brief.validate(
    {
      scale: "village",
      name: "Nowhere",
      places: [{ kind: "gathering", name: "The Wet Boot", flavor: "" }],
      cast: [
        { name: "Ivo Reed", role: "miller", kind: "maker", tint: "teal", home: "Nowhere", household: 1 },
        { name: "Sela Reed", role: "farmhand", kind: "grower", tint: "green", home: "Nowhere", household: 2 },
        { name: "Bram", role: "carter", kind: "maker", tint: "amber", home: "Nowhere", household: 3 },
        { name: "Odi", role: "child", kind: "child", tint: "rose", home: "Nowhere", household: 3 },
      ],
    },
    { theme: "cozy-village", seed: 606 },
  );
  const hw = world.build(606, "cozy-village", hostless);
  const hsim = new loadedPF.Sim(hw);
  const hcore = { chatId: "chat-berth-room-hostless", sim: hsim, hud: { toast() {}, refreshChips() {} } };
  P.award(hcore, { money: 100 });
  for (const zoneId of Object.keys(hw.zones)) {
    assert.notEqual(hw.zones[zoneId].lodging, true, `hostless: ${zoneId} is not marked lodging`);
    hsim.zoneId = zoneId;
    hsim.nearNpc = null;
    assert.equal(E.berthOffer(hcore).price, null, `hostless: standing in ${zoneId} quotes no price`);
  }

  // The invariant itself, said structurally rather than incidentally: the zone
  // mark is only ever up because a placed NPC took the keeper's mark for it.
  for (const [label, lw] of [
    ["the playtest village", w],
    ["a brief that homes no host", hw],
    ["legacy", world.build(9001, "cozy-village")],
  ]) {
    const marks = Object.values(lw.zones)
      .flatMap((zone) => zone.npcs)
      .filter((npc) => typeof npc.lodging === "string" && npc.lodging)
      .map((npc) => npc.lodging);
    for (const [zoneId, zone] of Object.entries(lw.zones)) {
      if (zone.lodging !== true) continue;
      assert.ok(marks.includes(zoneId), `${label}: ${zoneId} is marked lodging and somebody is letting it`);
    }
    for (const zoneId of marks) {
      assert.equal(lw.zones[zoneId]?.lodging, true, `${label}: a keeper's room is marked lodging`);
    }
  }
  loadedPF.save.reset();
}

// ── AND THE PAIRING IS THE COMPILER'S, NOT THE FIXTURES' ──────────────────────
// Everything above reads worlds the compiler actually produces, and on every one
// of them the keeper stamp lands — so those cases hold whether the zone mark
// WAITS for the stamp or is merely written beside it, and reverting 20-world's
// `stamped` block leaves them green. The structural claim is the one the offer
// depends on: 59-economy's room path finds a keeper THROUGH the zone mark, so a
// mark raised without a stamp is exactly the counter with nobody behind it.
//
// A stamp that misses is unreachable through a brief — every validated roster
// entry is placed as an NPC under its own name — so the only honest way to
// exercise the branch is to force it. The rewrite goes on the HOST RESOLUTION
// rather than on the stamp loop: resolving a host and stamping one are the two
// different facts the block is about, the resolution line is the same on either
// side of the fix, and forcing a resolved host nobody carries the name of asks
// the compiler the question directly.
{
  const HOST_LINE = "const host = facade?.owner ?? headOfBuilding.get(gatheringZoneId) ?? null;";
  const FORCED_MISS =
    "const host = ((resolved) => (resolved ? { ...resolved, name: `${resolved.name}\\u0000` } : null))(" +
    "facade?.owner ?? headOfBuilding.get(gatheringZoneId) ?? null);";
  const parts = [
    "00-prelude.js",
    "10-art.js",
    "15-assets.js",
    "18-brief.js",
    "20-world.js",
    "25-schedule.js",
    "30-sim.js",
    "50-spatial.js",
    "55-maps-export.js",
    "58-player.js",
    "59-economy.js",
    "60-save.js",
  ].map((file) => {
    const text = readFileSync(join(here, "src", file), "utf8");
    if (file !== "20-world.js") return text;
    const forced = text.replace(HOST_LINE, FORCED_MISS);
    assert.notEqual(forced, text, "the forced-miss rewrite still names 20-world's host resolution");
    return forced;
  });
  const forcedPF = new Function(`"use strict";\n${parts.join("\n")}\nreturn PF;`)();
  forcedPF.assets._noPackage = true;
  forcedPF.api.postSpatialLocations = async () => ({ ok: false, status: 404, body: null });
  forcedPF.api.patchMetadata = async () => {};
  const sealed = forcedPF.brief.validate(
    {
      scale: "village",
      name: "Hearthvale",
      prosperity: "modest",
      backgroundPopulation: 40,
      situation: "Pumpkins keep going missing from the fair field.",
      places: [{ kind: "gathering", name: "The Amber Hearth", flavor: "A honey-lit inn." }],
      cast: [
        { name: "Mira", role: "Innkeeper", kind: "host", tint: "amber", home: "The Amber Hearth", household: 1 },
        { name: "Rook", role: "Guard Captain", kind: "guard", tint: "blue", home: "The Amber Hearth", household: 1 },
        { name: "Tam", role: "Farmer", kind: "grower", tint: "green", home: "Hearthvale", household: 2 },
      ],
    },
    { theme: "cozy-village", seed: 2095930824 },
  );
  const fw = forcedPF.world.build(2095930824, "cozy-village", sealed);
  const fgid = Object.entries(sealed._ids.zones).find(([, name]) => name === "The Amber Hearth")?.[0];
  assert.ok(fgid && fw.zones[fgid], "the forced world still compiles the gathering it was told about");
  assert.equal(
    Object.values(fw.zones).some((zone) => (zone.npcs ?? []).some((npc) => npc.lodging)),
    false,
    "a host resolved under a name nobody carries stamps no keeper anywhere",
  );
  assert.notEqual(
    fw.zones[fgid].lodging,
    true,
    "…and the zone mark does not go up without one — both marks or neither, structurally",
  );
}

// ── AN OWNER HOMED AT THE SETTLEMENT ROOT STANDS AT THEIR OWN STATION (0.11) ──
// `home` naming the SETTLEMENT is the ordinary shape and not a corner case: the
// STOCK_CAST top-up roster carries no `home` of its own — so every quality-floor
// cast homes its innkeeper at the root (the second playtest's own shape; the
// DEFAULT briefs are fine, homing their hosts at the inn by name) — and it is
// also what a model writes when it is not thinking about buildings. That innkeeper stood on
// the door apron of the inn they run, from waking to sleeping, with the lit
// common room and the counter behind them.
//
// The promotion that sends an owner inside gates on `owned.interior?.post`, and
// `interior` was only ever set by the COMPILER-MINTED building loop — where the
// station comes from WORK_POSTS, a table whose one entry is `shop`. A facade the
// PLACES pass built (every gathering, every sanctuary) never carried the handle
// at all, so the gate could not fire however the schedule was written. And the
// schedule was never the problem: `host:resident` is already post/post/post/home
// and the runtime handle is built FROM the promotion's result, so the one site
// fixes the spawn and the whole day at once.
//
// The SANCTUARY had the identical gap for the identical reason, and its keeper
// tier (`*:resident:keeper`) holds them at `post` from dawn to dusk — so an elder
// homed at the settlement kept the church STEP for the whole of daylight.
{
  const E = loadedPF.economy;
  const P = loadedPF.player;
  /** Every tile of a station is standable, and the fitting it serves stands
   *  between it and the way in — which is what makes it the BACK of the counter
   *  rather than the front of it. Asserted against the tiles the furnisher
   *  actually painted, so the claim survives the furniture being moved. */
  const checkStation = (zone, fitting, label) => {
    const post = zone.post;
    assert.ok(post, `${label}: the furnisher recorded a station`);
    for (let y = post.y0; y <= post.y1; y++) {
      for (let x = post.x0; x <= post.x1; x++) {
        assert.ok(loadedPF.schedule.standable(zone, x, y), `${label}: the station tile ${x},${y} is standable`);
        assert.equal(zone.object[zone.w * (y + 1) + x], fitting, `${label}: the ${fitting} stands south of ${x},${y}`);
      }
    }
    assert.ok(post.y1 < zone.spawn.y, `${label}: the ${fitting} stands between the station and the door`);
    return post;
  };

  const innBrief = (home) => ({
    scale: "village",
    name: "Fernmoor",
    prosperity: "modest",
    places: [{ kind: "gathering", name: "The Amber Hearth", flavor: "Low beams and a tall fire." }],
    cast: [
      { name: "Mira", role: "innkeep", kind: "host", tint: "amber", home, household: 1 },
      // A second body in the room to be nearer to, placed by NAME so the inn
      // gains an occupant without gaining a RESIDENT — a resident grows living
      // quarters, which moves `floor0` and makes this a different building.
      {
        name: "Tam",
        role: "potboy",
        kind: "folk",
        tint: "teal",
        home: "Fernmoor",
        workplace: "The Amber Hearth",
        household: 2,
      },
    ],
  });

  // (a) THE REPORTED SHAPE: the keeper of the inn, homed at the town.
  const sealed = brief.validate(innBrief("Fernmoor"), { theme: "cozy-village", seed: 8080 });
  const w = world.build(8080, "cozy-village", sealed);
  checkWorld(w, sealed, "root-homed host");
  const gid = Object.entries(sealed._ids.zones).find(([, name]) => name === "The Amber Hearth")?.[0];
  assert.ok(gid && w.zones[gid], "the declared gathering compiled to a room");
  const room = w.zones[gid];

  // IN the room — compiled into `zone.npcs`, which is what the room path reads
  // and what the daypart splice moves — and not merely pointed at it.
  const mira = room.npcs.find((npc) => npc.name === "Mira");
  assert.ok(mira, `the innkeeper stands IN ${gid} rather than on its doorstep`);
  assert.equal(mira._sched.post.zoneId, gid, "and her day handle names that room");

  // …AT THE SERVING ROW, which is the row behind the counter.
  const innPost = checkStation(room, "counter", "the inn");
  assert.deepEqual(mira._sched.post.wander, innPost, "her day box IS the station, not the room's middle");
  assert.ok(
    mira.x >= innPost.x0 && mira.x <= innPost.x1 && mira.y >= innPost.y0 && mira.y <= innPost.y1,
    `and she is compiled onto it (${mira.x},${mira.y} in ${JSON.stringify(innPost)})`,
  );

  // NO REHOUSING. Days at the station, nights in her own bed: the night handle is
  // still the dwelling her household claimed, and it is a MINTED `h*` zone rather
  // than the inn. Where somebody works must never move where they sleep.
  assert.ok(mira._sched.home, "she still has a bed to go to");
  assert.notEqual(mira._sched.home.zoneId, gid, "the station did not rehouse her into the inn");
  assert.match(mira._sched.home.zoneId, /^h\d+$/, "her bed is in her household's own dwelling");
  {
    const dwelling = w.zones[mira._sched.home.zoneId];
    const bed = mira._sched.home.wander;
    assert.equal(bed.x0, bed.x1, "a night handle is one tile — a bed, not a box");
    assert.ok(
      ["bed", "bunk"].includes(dwelling.object[dwelling.w * bed.y0 + bed.x0]),
      "…and there is a bed painted on it",
    );
  }

  // (d) THE OFFER FOLLOWS HER INTO THE ROOM. The room path reads `zone.npcs`, so
  //     until she was compiled into the inn the lodging mark was up on a room the
  //     keeper was never standing in — a player inside the inn with the innkeeper
  //     out on the step got the offer only by walking back out to her.
  assert.equal(room.lodging, true, "the room carries the lodging mark");
  const bystander = room.npcs.find((npc) => npc.name === "Tam");
  assert.ok(bystander, "with somebody else in the room to be nearer to");
  {
    const sim = new loadedPF.Sim(w);
    const core = { chatId: "chat-berth-root-host", sim, hud: { toast() {}, refreshChips() {} } };
    P.award(core, { money: 100 });
    sim.zoneId = gid;
    sim.nearNpc = bystander;
    const offer = E.berthOffer(core);
    assert.equal(offer.available, true, "standing in the inn is an offer even with a bystander nearer");
    assert.equal(offer.keeper?.name, "Mira", "…answered by the keeper who is behind the counter");
    assert.equal(offer.zoneId, gid, "…for the room she keeps");
  }

  // AND SHE HOLDS IT THROUGH THE DAY. `host:resident` is post/post/post/home, and
  // `post` is now the station, so the three daylight dayparts put her behind her
  // own counter and only night takes her home.
  {
    const sim = new loadedPF.Sim(w);
    const inRoom = () => w.zones[gid].npcs.some((npc) => npc.name === "Mira");
    for (const [minutes, part] of [
      [6 * 60, "dawn"],
      [12 * 60, "day"],
      [19 * 60, "dusk"],
    ]) {
      sim.clockMin = minutes;
      sim.resolveSchedules();
      assert.ok(inRoom(), `at ${part} the innkeeper is behind her own counter`);
    }
    sim.clockMin = 2 * 60;
    sim.resolveSchedules();
    assert.ok(!inRoom(), "and at night she is in her own bed, not among the tables");
  }

  // (b) THE SHAPE THAT ALREADY WORKED IS UNTOUCHED. A keeper the brief homes AT
  //     the place was never on the apron — the root-home branch is the only one
  //     that was — so she still gets the room's walkable middle, which is a box
  //     strictly bigger than the station in both directions.
  {
    const homed = brief.validate(innBrief("The Amber Hearth"), { theme: "cozy-village", seed: 8080 });
    const hw = world.build(8080, "cozy-village", homed);
    checkWorld(hw, homed, "host homed at the inn");
    const hid = Object.entries(homed._ids.zones).find(([, name]) => name === "The Amber Hearth")?.[0];
    const hroom = hw.zones[hid];
    const npc = hroom.npcs.find((entry) => entry.name === "Mira");
    assert.ok(npc, "a host homed at the inn is still compiled into it");
    assert.equal(npc._sched.post.zoneId, hid, "and her day handle is still that room");
    const station = checkStation(hroom, "counter", "the inn she lives in");
    const box = npc._sched.post.wander;
    assert.ok(
      box.x0 < station.x0 && box.y1 > station.y1,
      `she keeps the room's middle, not the station (${JSON.stringify(box)} vs ${JSON.stringify(station)})`,
    );
    assert.equal(npc._sched.home?.zoneId, hid, "and her bed is still in the quarters the building grew");
  }

  // (c) THE SANCTUARY, SAME GAP AND SAME FIX. Its station is the chancel: the
  //     walkable row behind the altar, at the head of the aisle. The altar row
  //     itself is solid end to end (altar plus both candle plinths), so the row
  //     above it is the only place a keeper can actually stand.
  {
    const sealedChurch = brief.validate(
      {
        scale: "village",
        name: "Fernmoor",
        prosperity: "modest",
        places: [{ kind: "sanctuary", name: "St Aldwin's", flavor: "A cold stone nave." }],
        cast: [
          { name: "Wen", role: "prior", kind: "elder", tint: "violet", home: "Fernmoor", household: 1 },
          { name: "Halla", role: "farmer", kind: "grower", tint: "green", home: "Fernmoor", household: 2 },
        ],
      },
      { theme: "cozy-village", seed: 8080 },
    );
    const cw = world.build(8080, "cozy-village", sealedChurch);
    checkWorld(cw, sealedChurch, "root-homed keeper");
    const sid = Object.entries(sealedChurch._ids.zones).find(([, name]) => name === "St Aldwin's")?.[0];
    assert.ok(sid && cw.zones[sid], "the declared sanctuary compiled to a room");
    const nave = cw.zones[sid];
    const wen = nave.npcs.find((npc) => npc.name === "Wen");
    assert.ok(wen, `the keeper stands IN ${sid} rather than on the church step`);
    assert.equal(wen._sched.keeper, true, "carrying the keeper tier that holds them there all day");
    const chancel = checkStation(nave, "altar", "the sanctuary");
    assert.deepEqual(wen._sched.post.wander, chancel, "and their day box is the chancel");
    assert.match(wen._sched.home?.zoneId ?? "", /^h\d+$/, "while their bed stays at the dwelling they were housed in");
  }
}

// ── THE CLASSIFIER CARRIES IT AND DECIDES NOTHING WITH IT ─────────────────────
{
  const decided = (schemaVersion) =>
    loadedPF.save.classify(
      {
        failed: false,
        probe: {
          available: true,
          status: 200,
          body: { exists: true, schemaVersion, state: { v: 1, player: { v: 1, game: 1 } } },
        },
      },
      { serverSerialized: null, localSerialized: '{"mine":1}', game: 1, now: Date.now() },
    );
  assert.equal(decided(1).rowSchemaVersion, 1, "the decision carries the row's era for a caller to read");
  assert.equal(decided(9).row, decided(1).row, "…and no value of it moves the verdict");
  for (const bad of [undefined, null, 0, -3, 2.5, "1", 1_000_001]) {
    assert.equal(decided(bad).rowSchemaVersion, null, `an unusable column (${String(bad)}) simply says nothing`);
  }
  assert.equal(
    loadedPF.save.classify({ failed: true, error: null }, {}).rowSchemaVersion,
    null,
    "a probe that did not answer has no row to describe",
  );
  assert.equal(
    loadedPF.save.classify({ failed: false, probe: { available: false, status: 404 } }, {}).rowSchemaVersion,
    null,
    "…and neither does a route that is not there",
  );
  loadedPF.save.reset();
}

// ── §4.3 IS A POST-CONDITION ON THE SEALED CAST, NOT ON THE MODEL'S DRAFT ─────
// The host-gathering synthesis ran in the PLACES pass, against `asArray(src.cast)`
// — the raw model cast, two passes before the cast quality floor tops one up from
// stock. Every stock roster leads with a `host`, so the one brief that needs the
// synthesis most — a cast that failed validation outright — was exactly the brief
// that never got it: the floor handed the settlement a keeper and the places floor
// handed it a wilds, and the sealed brief carried a host with nowhere to keep.
//
// That is not a cosmetic gap. The compiler builds the common room from the
// gathering PLACE (a `host` in the cast alone binds to nothing — the hostless
// fixture below pins that seam), so the live playtest compiled fifteen zones of
// "X's home" plus a farm: no cantina, no lodging mark, no keeper, and the berth
// the release ships was unreachable in a real generated world.
{
  const P = loadedPF.player;
  const E = loadedPF.economy;
  // A raw brief whose cast is entirely unusable: no entry survives capText, so the
  // cast pass keeps nobody at all. This is the playtest's shape and its seed.
  const rawBrief = { scale: "village", name: "Anchorage Nine", cast: [{ role: "colonist" }, { name: "  " }] };
  const sealed = brief.validate(rawBrief, { theme: "sci-fi-colony", seed: 1980690972 });
  const host = sealed.cast.find((member) => member.kind === "host");
  assert.ok(host, "the cast floor topped a host up from stock");
  const gatherings = sealed.places.filter((place) => place.kind === "gathering");
  assert.equal(gatherings.length, 1, "and the sealed brief carries exactly one gathering for them to keep");
  assert.ok(sealed.places.length <= brief.CAPS.places, "inside the room the rank has for places");
  assert.ok(
    sealed._repairs.some((entry) => entry.includes("synthesized a gathering interior")),
    "the repair is on the ledger, not silent",
  );
  // NAMED LIKE AN INN, not like one more house on the row. `${hostName}'s` sat in
  // a street of "Rook's home" and "Fen's home" and read as another door; both
  // default briefs already carry the idiom (the Amber Hearth INN, the Meridian
  // CANTINA), so the theme has the word.
  assert.ok(gatherings[0].name.includes(host.name), "named from the host who keeps it");
  assert.ok(gatherings[0].name.endsWith("Cantina"), "…in the colony's own word for a common room");
  const cozy = brief.validate(rawBrief, { theme: "cozy-village", seed: 1980690972 });
  assert.ok(
    cozy.places.find((place) => place.kind === "gathering")?.name.endsWith("Inn"),
    "…and the village's word in the village",
  );

  // THE WHOLE VERTICAL, through the compiler the playtest actually ran.
  const w = world.build(1980690972, "sci-fi-colony", sealed);
  const gatheringId = Object.entries(sealed._ids.zones).find(([, name]) => name === gatherings[0].name)?.[0];
  assert.ok(gatheringId && w.zones[gatheringId], "the gathering compiled to a zone of its own");
  assert.equal(w.zones[gatheringId].lodging, true, "which the compiler marks as lodging");
  const keeper = Object.values(w.zones)
    .flatMap((zone) => zone.npcs)
    .find((npc) => npc.lodging === gatheringId);
  assert.ok(keeper, "with somebody behind the counter");
  assert.equal(keeper.name, host.name, "…the host the floor topped up");
  const sim = new loadedPF.Sim(w);
  const core = { chatId: "chat-anchorage", sim, hud: { toast() {}, refreshChips() {} } };
  P.award(core, { money: 100 });
  sim.zoneId = gatheringId;
  sim.nearNpc = keeper;
  const offer = E.berthOffer(core);
  assert.equal(offer.available, true, "and a berth the player can actually take");
  assert.equal(offer.zoneId, gatheringId, "at the gathering that used to be missing");
}

// (az) THE FEATURE REGISTRY: WHERE A NAMED FEATURE ACTUALLY STANDS (0.12 slice 1).
// A brief names its features and the compiler paints them, and until now nothing
// wrote down WHERE. The tiles were the only record, and a tile cannot say which
// feature it belongs to or what the brief called it. `zone.features[]` is that
// record — {id, tag, name, rect} — written by the three sites that paint one:
// the compiler's placement loops, the wilds builder's `water-crossing` branch
// (which paints the stream itself, because the feature loop skips that tag), and
// buildLegacy's fixed literals.
//
// Three properties are load-bearing and each has its own case below: the ids are
// the BRIEF's ordinals and do not shuffle when a feature finds no room, the
// wilds stream gets a row at all, and the whole list is DERIVED — a world is
// rebuilt from (seed, theme, brief) on every load, so the registry must cost
// exactly zero save bytes.
{
  const cast = [
    { name: "Ivy", role: "warden", kind: "leader", tint: "blue", home: "Greenwood", household: 1 },
    { name: "Bett", role: "innkeep", kind: "host", tint: "amber", home: "Greenwood", household: 2 },
  ];
  const seal = (features, places, scale, prosperity, seed) =>
    brief.validate(
      { scale, prosperity, name: "Greenwood", surround: "woods", features, places, cast },
      { theme: "cozy-village", seed },
    );
  const wildsPlace = {
    kind: "wilds",
    name: "The Wood",
    features: [
      { tag: "water-crossing", name: "The Ford" },
      { tag: "landmark-stone", name: "The Marker" },
    ],
  };
  const registryOf = (w) =>
    Object.fromEntries(Object.keys(w.zones).map((zoneId) => [zoneId, w.zones[zoneId].features]));

  // ── DETERMINISM: the same seed and the same brief record the same rows ──────
  // The registry is rebuilt on every load, so a row that drifted between two
  // builds of one world would be a spot the player could stand at yesterday and
  // not today. Ids, tags, names and rects, all of it, across every zone.
  {
    const sealed = seal(
      [
        { tag: "water-feature", name: "The Millpond" },
        { tag: "crop-plots", name: "The Rows" },
      ],
      [wildsPlace],
      "village",
      "modest",
      606,
    );
    const built = world.build(606, "cozy-village", sealed);
    // EVERY zone carries the list, not only the ones that hold something: an
    // absent array and an empty one read the same at a call site right up until
    // the one that does not guard, and the consumer reads it every walking frame.
    for (const zoneId of Object.keys(built.zones))
      assert.ok(Array.isArray(built.zones[zoneId].features), `${zoneId}: the zone carries a feature registry`);
    const first = registryOf(built);
    const second = registryOf(world.build(606, "cozy-village", sealed));
    assert.deepEqual(second, first, "same seed + same brief, same registry — rows do not drift between builds");
    const rows = Object.values(first).flat();
    assert.ok(rows.length >= 3, `and the sweep saw real rows (${rows.length})`);
    for (const row of rows) {
      assert.ok(/^f\d+$/.test(row.id), `${row.name}: a compiled row carries a brief ordinal, not "${row.id}"`);
      assert.ok(loadedPF.brief.FEATURE_TAGS.includes(row.tag), `${row.name}: tagged from the closed vocabulary`);
      assert.ok(
        Number.isInteger(row.rect.x) && Number.isInteger(row.rect.y) && row.rect.w > 0 && row.rect.h > 0,
        `${row.name}: a real rect`,
      );
    }
    // …and the ids the compiler wrote are the ids the SEAL minted, not a
    // parallel numbering that happens to agree today.
    for (const row of rows) assert.equal(sealed._ids.features[row.id], row.name, `${row.id} is the sealed ordinal`);
  }

  // ── AN UNPLACEABLE FEATURE STILL SPENDS ITS ORDINAL ─────────────────────────
  // An outpost is 560 tiles and its lots take most of them, so a fenced 8x5 crop
  // plot declared second has genuinely nowhere to stand and is dropped ("a
  // plainer settlement, never a sealed one"). What must NOT happen is the
  // features after it sliding down a number: the sealed brief already promised
  // `f3` to the wilds ford, and a registry that renumbered on a full map would
  // be unquotable across two worlds built from one brief.
  {
    const sealed = seal(
      [
        { tag: "landmark-stone", name: "The Stone" },
        { tag: "crop-plots", name: "The Rows" },
      ],
      [wildsPlace],
      "outpost",
      "struggling",
      909,
    );
    assert.deepEqual(
      sealed._ids.features,
      { f1: "The Stone", f2: "The Rows", f3: "The Ford", f4: "The Marker" },
      "the seal minted four ordinals, settlement first then the place's",
    );
    const w = world.build(909, "cozy-village", sealed);
    const wildsId = `z${sealed.places.findIndex((place) => place.kind === "wilds") + 2}`;
    assert.deepEqual(
      w.zones.z1.features.map((row) => `${row.id}:${row.name}`),
      ["f1:The Stone"],
      "the outpost placed the stone and dropped the rows",
    );
    assert.deepEqual(
      w.zones[wildsId].features.map((row) => `${row.id}:${row.name}`),
      ["f3:The Ford", "f4:The Marker"],
      "and the dropped feature still SPENT f2 — the ford is f3, not f2",
    );
    const again = world.build(909, "cozy-village", sealed);
    assert.deepEqual(again.zones[wildsId].features, w.zones[wildsId].features, "stable across builds");
  }

  // ── THE WILDS STREAM IS A SPOT, NOT DEAD WATER ──────────────────────────────
  // The wilds builder paints its stream itself (20-world's `water-crossing`
  // branch) and the feature loop below it skips the tag outright, so the branch
  // is the only site that can owe the crossing a row. Without it a brief-built
  // stream would be water nothing knows the name of, while a legacy one fishes.
  {
    const sealed = seal([{ tag: "shrine", name: "The Shrine" }], [wildsPlace], "village", "modest", 313);
    const w = world.build(313, "cozy-village", sealed);
    const wildsId = `z${sealed.places.findIndex((place) => place.kind === "wilds") + 2}`;
    const stream = w.zones[wildsId].features.find((row) => row.tag === "water-crossing");
    assert.ok(stream, "the wilds crossing is on the register");
    assert.equal(stream.name, "The Ford", "under the name the brief gave it");
    assert.equal(sealed._ids.features[stream.id], "The Ford", "and its own brief ordinal");
    assert.deepEqual(stream.rect, { x: 20, y: 1, w: 2, h: 22 }, "covering the stream the branch actually painted");
    // Non-vacuous: that rect is where the water is.
    const wilds = w.zones[wildsId];
    let inside = 0;
    for (let y = 1; y < 23; y++) for (let x = 20; x < 22; x++) if (wilds.ground[y * wilds.w + x] === "water") inside++;
    assert.equal(inside, 40, `the rect holds the stream (${inside} water tiles, the ford's four laid over it)`);
    // AND THE FOUR LAID OVER IT ARE THE BRIDGE (0.12 slice 3b). The ford was
    // hand-laid `path` and the ruling migrated it: a road carried over water is
    // one picture now, whether the road is a compiled pool's carriageway or a
    // crossing the brief asked for by name. Non-solid as it always was — the
    // count above is what proves the ford did not become water, and this is what
    // proves it did not stay a paved road through a stream.
    for (const [fx, fy] of [
      [20, 12],
      [21, 12],
      [20, 13],
      [21, 13],
    ]) {
      assert.equal(wilds.ground[fy * wilds.w + fx], "bridge", `the ford at (${fx},${fy}) is decked, not paved`);
      assert.ok(!wilds.solid[fy * wilds.w + fx], `…and (${fx},${fy}) is still walked across`);
    }
  }

  // ── THE LEGACY WORLD'S TWO RESERVED ROWS ────────────────────────────────────
  // buildLegacy has no brief to mint ids from, so its water carries fixed
  // reserved ids at the literals — and TAGS, because the consumer resolves its
  // table by (theme, tag) and a legacy spot has to resolve like any other.
  for (const theme of ["cozy-village", "sci-fi-colony"]) {
    const w = world.build(77, theme, null);
    const rows = Object.values(w.zones).flatMap((zone) => zone.features);
    assert.equal(rows.length, 2, `${theme}: the legacy layout reserves exactly two water features`);
    const pond = w.zones.village.features;
    const stream = w.zones.forest.features;
    assert.equal(pond.length, 1, `${theme}: the village keeps its pond`);
    assert.equal(stream.length, 1, `${theme}: the wood keeps its stream`);
    assert.equal(pond[0].id, "legacy:pond", `${theme}: at a reserved id`);
    assert.equal(pond[0].tag, "water-feature", `${theme}: tagged so the table resolves`);
    assert.deepEqual(pond[0].rect, { x: 33, y: 21, w: 7, h: 5 }, `${theme}: at the literal it is painted from`);
    assert.equal(stream[0].id, "legacy:stream", `${theme}: at a reserved id`);
    assert.equal(stream[0].tag, "water-crossing", `${theme}: tagged so the table resolves`);
    assert.deepEqual(stream[0].rect, { x: 20, y: 1, w: 2, h: 22 }, `${theme}: at the literal it is painted from`);
    // Themed, and from the theme's OWN vocabulary for that tag — the names its
    // default brief already uses, so legacy and compiled worlds agree.
    assert.ok(pond[0].name && stream[0].name, `${theme}: both named`);
    assert.notEqual(pond[0].name, "water-feature", `${theme}: a name, not the tag`);
  }
  {
    const fantasy = world.build(77, "cozy-village", null);
    const scifi = world.build(77, "sci-fi-colony", null);
    assert.notEqual(
      fantasy.zones.village.features[0].name,
      scifi.zones.village.features[0].name,
      "and the two themes do not call it the same thing",
    );
  }

  // ── nearFeature: WATER **AND** A RECT, NEITHER ALONE ────────────────────────
  // The step loop's third proximity read, beside nearNpc and nearPortal. A rect
  // may legitimately hold tiles the feature never watered — the ford is path
  // straight across the stream rect, and a compiled pool's well stands inside
  // the anchor rect beside it — so "inside a rect" cannot be the test. Standing
  // at the bank is.
  {
    const w = world.build(7, "cozy-village", null);
    const sim = new loadedPF.Sim(w);

    sim.teleport("village", 32, 23); // grass, one step west of the pond's west bank
    sim.step(0, {});
    assert.ok(sim.nearFeature, "standing at the bank finds the pond");
    assert.equal(sim.nearFeature.id, "legacy:pond", "…by name and id, not just 'some water'");
    assert.equal(sim.nearFeature.name, w.zones.village.features[0].name, "the registry row itself, not a copy");

    sim.teleport("village", 21, 17); // the spawn, mid-village: nowhere near water
    sim.step(0, {});
    assert.equal(sim.nearFeature, null, "and steps away from it again");

    // THE FORD, AND THE WELL BY THE SAME TEST. (22,12) is the east approach: its
    // west neighbour (21,12) is INSIDE the stream rect and is the path the ford
    // laid, and no neighbour of it is water. A rect-only test would call this
    // fishing; the two-sided test calls it a road.
    //
    // RE-BASELINED, 0.12 slice 3b: that tile read "path" until the bridge ruling
    // migrated the hand-laid ford onto the new tile (one visual system for every
    // road that crosses water). The ASSERTION is unchanged and is still the one
    // worth making — the tile inside the rect is not water — only the word for
    // what the ford is laid with has moved.
    const forest = w.zones.forest;
    assert.equal(forest.ground[12 * forest.w + 21], "bridge", "the ford's tile is inside the rect and is not water");
    sim.teleport("forest", 22, 12);
    sim.step(0, {});
    assert.equal(sim.nearFeature, null, "a rect tile that is not water is not a spot");

    sim.teleport("forest", 22, 10); // beside the stream proper, north of the ford
    sim.step(0, {});
    assert.equal(sim.nearFeature?.id, "legacy:stream", "…while the bank two tiles north of it is");
  }

  // ── THE ROAD MAY CROSS THE WATER NOW (0.12 slice 3b, the bridge ruling) ─────
  // Slice-1's verify found that a wilds `water-feature` can never place: the
  // anchor scan offers rows 8..11 and nothing else, an 8x5 rect starting on any
  // of them reaches the road band at y12..13, and the scan refuses every rect
  // that touches the road. A brief that asked for a pool in the wood therefore
  // got silence, on every seed. The maintainer's ruling is that the road wins
  // the tiles it is already standing on and the water takes the rest: road ∩
  // pool becomes BRIDGE — walkable, drawn over the water — and the placement is
  // permitted.
  //
  // Measured as a DIFFERENCE against the same wood with no features in it,
  // because there is no other way to know which tiles the road had.
  {
    const pool = { tag: "water-feature", name: "The Pool" };
    const town = [{ tag: "shrine", name: "The Shrine" }];
    const sealed = seal(town, [{ ...wildsPlace, features: [...wildsPlace.features, pool] }], "village", "modest", 313);
    const control = seal(town, [{ ...wildsPlace, features: [] }], "village", "modest", 313);
    const w = world.build(313, "cozy-village", sealed);
    const zone = w.zones[`z${sealed.places.findIndex((place) => place.kind === "wilds") + 2}`];
    const bare = world.build(313, "cozy-village", control).zones[zone.id];
    const row = zone.features.find((feature) => feature.tag === "water-feature");
    assert.ok(row, "the wilds pool PLACES — before the ruling it never did, on any seed");
    assert.equal(sealed._ids.features[row.id], "The Pool", "…through the normal path, under its own brief ordinal");
    // NO NEW ROW CLASS. The bridge is placement TREATMENT of a water feature and
    // not a feature of its own, so the register reads exactly as it would have if
    // the pool had found dry ground: three rows, three brief ordinals, in the
    // order the two writing sites run in.
    assert.deepEqual(
      zone.features.map((feature) => `${feature.tag}:${feature.name}`),
      ["water-crossing:The Ford", "landmark-stone:The Marker", "water-feature:The Pool"],
      "and mints no registry row of its own",
    );

    const groundAt = (z, x, y) => z.ground[y * z.w + x];
    let water = 0;
    let planked = 0;
    for (let y = row.rect.y; y < row.rect.y + row.rect.h; y++) {
      for (let x = row.rect.x; x < row.rect.x + row.rect.w; x++) {
        const now = groundAt(zone, x, y);
        const was = groundAt(bare, x, y);
        if (now === "water") {
          water++;
          assert.notEqual(was, "path", `(${x},${y}): water was painted straight over the road`);
          assert.ok(zone.solid[y * zone.w + x], `(${x},${y}): open water has to stay impassable`);
        } else if (now === "bridge") {
          planked++;
          assert.equal(was, "path", `(${x},${y}): a bridge over ground that was never a road`);
          assert.ok(!zone.solid[y * zone.w + x], `(${x},${y}): a solid bridge is a road that does not cross`);
        }
      }
    }
    // The pool is WHOLE — the placer's own 6x4 — whichever of the two tiles each
    // square ended up as. A pond that lost tiles instead of decking them would
    // show here as a total under 24, which is the millpond instrument's trick.
    assert.equal(water + planked, 24, `the pool is whole (${water} water + ${planked} bridge)`);
    assert.ok(planked > 0, "and the ruling's whole case is in it: part of the pool IS the road");
    // NOTHING SOLID IS LEFT STANDING IN THE CARRIAGEWAY. Tested over the whole
    // rect rather than over the water alone, because the pool paints an OBJECT
    // too — its companion WELL, which is solid and has no bridge story at all.
    // This is not hypothetical and it is why the relaxation had to be a second
    // pass: write it as a widened first pass instead and the pool anchors a row
    // lower, which stands the well at (15,12) in the middle of the road. No code
    // guards the well, deliberately — with the strict pass running first the
    // anchor that would put it there is refused before the road ever comes off
    // the table, and a guard nothing can turn red is worse than none.
    for (let y = row.rect.y; y < row.rect.y + row.rect.h; y++) {
      for (let x = row.rect.x; x < row.rect.x + row.rect.w; x++) {
        if (groundAt(bare, x, y) !== "path") continue;
        assert.ok(!zone.solid[y * zone.w + x], `(${x},${y}): the road is blocked where it used to run`);
      }
    }

    // END TO END, flood-filled rather than inferred: from the tile the portal
    // delivers the player onto, across the decked pool, and on across the ford to
    // the east approach. sealPockets closes anything it cannot reach, so a bridge
    // that failed to carry the road would show up as a SEALED far side rather
    // than as a hole — which is why the far tile is asserted reachable and not
    // merely non-solid.
    const reachable = (z, from, to) => {
      const seen = new Set([from.y * z.w + from.x]);
      const queue = [from];
      while (queue.length) {
        const { x, y } = queue.pop();
        if (x === to.x && y === to.y) return true;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= z.w || ny >= z.h) continue;
          const at = ny * z.w + nx;
          if (seen.has(at) || z.solid[at]) continue;
          seen.add(at);
          queue.push({ x: nx, y: ny });
        }
      }
      return false;
    };
    assert.ok(reachable(zone, { x: 2, y: 12 }, { x: 24, y: 12 }), "the road still crosses the wood, pool and all");

    // FISHING FROM THE BRIDGE, which the ruling gets for nothing: the shipped
    // two-sided test asks whether a NEIGHBOUR is water inside a rect and has no
    // opinion about what the player is standing on. A plank over the pool is a
    // jetty by construction.
    let deck = null;
    for (let y = row.rect.y; y < row.rect.y + row.rect.h && !deck; y++)
      for (let x = row.rect.x; x < row.rect.x + row.rect.w && !deck; x++)
        if (groundAt(zone, x, y) === "bridge") deck = { x, y };
    assert.ok(deck, "there is a plank to stand on");
    try {
      const sim = new loadedPF.Sim(w);
      sim.teleport(zone.id, deck.x, deck.y);
      sim.step(0, {});
      assert.equal(sim.nearFeature?.id, row.id, "standing ON the bridge is standing at the pool");
      const core = { chatId: "chat-bridge-cast", sim, hud: { toast() {}, refreshChips() {} }, markDirty() {} };
      loadedPF.player.grant(core, { t: "rod", k: "crude" }, 1);
      const offer = loadedPF.economy.fishOffer(core);
      assert.equal(offer.available, true, "…and the water is on offer from up there");
      assert.equal(offer.spot.id, row.id, "…naming the pool the plank is laid across");

      // AND IT IS WALKABLE, driven through the real Sim rather than read off the
      // solidity map: the feet box spans more than the tile underfoot, so a
      // bridge one tile wide with water either side has to be tested by walking.
      const before = sim.x;
      for (let i = 0; i < 30; i++) sim.step(1 / 60, { left: true });
      assert.ok(Math.abs(sim.x - before) > 1, "the player walks the bridge instead of standing on the water");
    } finally {
      loadedPF.save.reset(); // the mutators self-dirty, and a dirty block arms a timer
    }
  }

  // ── A POOL THAT ALREADY FITTED DOES NOT MOVE (0.12 slice 3b) ────────────────
  // The relaxation is a SECOND pass, and this is what that buys: the strict scan
  // runs first and unchanged, so a wood whose road hangs off the other edge —
  // the west-hung wilds, where the approach runs x16..34 — still finds the dry
  // anchor it always found, lays no plank, and compiles the tiles it always did.
  // A relaxation written as a widened first pass would have moved every one of
  // them, which is the version of this change that would have been wrong.
  {
    const pool = { tag: "water-feature", name: "The Pool" };
    const wood = { ...wildsPlace, features: [...wildsPlace.features, pool] };
    const sealed = seal([], [wood, { ...wood, name: "The Far Wood" }], "village", "modest", 313);
    const w = world.build(313, "cozy-village", sealed);
    const west = w.zones[`z${sealed.places.map((place) => place.kind).lastIndexOf("wilds") + 2}`];
    const row = west.features.find((feature) => feature.tag === "water-feature");
    assert.ok(row, "the west-hung wood places its pool too");
    let water = 0;
    let planked = 0;
    for (let y = row.rect.y; y < row.rect.y + row.rect.h; y++)
      for (let x = row.rect.x; x < row.rect.x + row.rect.w; x++) {
        if (west.ground[y * west.w + x] === "water") water++;
        if (west.ground[y * west.w + x] === "bridge") planked++;
      }
    assert.equal(water, 24, "…whole, on dry ground, the way the strict scan already placed it");
    assert.equal(planked, 0, "…and with no plank in it, because no road was ever in the way");
    // AND AT THE SAME ANCHOR, which is the property this case is NAMED after and
    // was the one thing it did not check (verify-3c F1). Counting water and
    // planks says the pool is whole and dry — and a MOVED pool says exactly that
    // too: written as a widened first pass instead of a second one, this pool
    // relocates to (9,11) and still lands 24 water tiles with no plank in them,
    // so the case stayed green against the mutant it exists to catch.
    assert.deepEqual(row.rect, { x: 6, y: 10, w: 8, h: 5 }, "…on the anchor the strict scan has always given it");
  }

  // ── …AND WHAT DOES MOVE IS DECLARED (0.12 slice 3b) ─────────────────────────
  // A confined sub-class of the ruling's own movement, recorded rather than left
  // to be discovered (verify-3c F2). Anchors come off a cursor SHARED by every
  // feature in a place's list, so a water feature that spends extra attempts
  // before it settles hands the next feature a different cursor — and the
  // features that move are the ones declared AFTER a pool, in a wood that now
  // has a pool to declare.
  //
  // Measured across the shape: no zone moved without also gaining a pool, and no
  // row was dropped. That is what makes it confined rather than drift, and it is
  // part of "the wilds pond now places" rather than a second change hiding
  // inside it. Pinned so the next thing that moves this stone has to re-pin it
  // deliberately.
  {
    const pool = { tag: "water-feature", name: "The Pool" };
    const first = { ...wildsPlace, features: [pool, ...wildsPlace.features] };
    const sealed = seal([], [first], "village", "modest", 313);
    const control = seal([], [{ ...wildsPlace }], "village", "modest", 313);
    const zoneId = `z${sealed.places.findIndex((place) => place.kind === "wilds") + 2}`;
    const rect = (w, tag) => w.zones[zoneId].features.find((row) => row.tag === tag)?.rect;
    const withPool = world.build(313, "cozy-village", sealed);
    const without = world.build(313, "cozy-village", control);
    assert.ok(rect(withPool, "water-feature"), "the pool declared FIRST places, as the ruling intends");
    assert.deepEqual(
      rect(without, "landmark-stone"),
      { x: 26, y: 8, w: 3, h: 3 },
      "without a pool in front of it the marker stands where it always has",
    );
    assert.deepEqual(
      rect(withPool, "landmark-stone"),
      { x: 17, y: 9, w: 3, h: 3 },
      "and with one in front of it it moves ONE place along the shared cursor — declared, not drift",
    );
    assert.equal(
      withPool.zones[zoneId].features.length,
      without.zones[zoneId].features.length + 1,
      "…and nothing was dropped to make room for it",
    );
  }

  // ── DETERMINISM ACROSS PROCESSES, BRIDGE AND ALL (0.12 slice 3b) ────────────
  // The registry lane above proves two builds inside ONE process agree. That is
  // the weaker half: the bridge substitution reads the ground a previous pass
  // painted, so it is the first placement decision in the compiler that depends
  // on state rather than on arithmetic, and "same answer in a fresh interpreter"
  // is the property a player actually relies on — they compile this world again
  // tomorrow, in a browser that has just started.
  {
    const pool = { tag: "water-feature", name: "The Pool" };
    const sealed = seal([], [{ ...wildsPlace, features: [...wildsPlace.features, pool] }], "village", "modest", 313);
    const digest = (w) =>
      createHash("sha256")
        .update(
          JSON.stringify(
            Object.values(w.zones).map((zone) => [zone.id, zone.ground, zone.object, [...zone.solid], zone.features]),
          ),
        )
        .digest("hex");
    const mine = digest(world.build(313, "cozy-village", sealed));
    // The child re-READS the modules rather than being handed them: a Windows
    // command line is measured in tens of kilobytes and the package is measured
    // in hundreds, so passing the source would have made this case fail for a
    // reason that has nothing to do with the compiler.
    const child = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import { createHash } from "node:crypto";
         import { readFileSync } from "node:fs";
         import { join } from "node:path";
         const here = ${JSON.stringify(here)};
         const src = ${JSON.stringify(MODULES)}.map((f) => readFileSync(join(here, "src", f), "utf8")).join("\\n");
         const PF = new Function('"use strict";\\n' + src + "\\nreturn PF;")();
         const w = PF.world.build(313, "cozy-village", ${JSON.stringify(sealed)});
         process.stdout.write(createHash("sha256").update(JSON.stringify(
           Object.values(w.zones).map((zone) => [zone.id, zone.ground, zone.object, [...zone.solid], zone.features]),
         )).digest("hex"));`,
      ],
      // Bounded, or a hung child blocks this SYNCHRONOUS call where no watchdog
      // timer can fire — the one hang class the deadline above cannot break.
      { encoding: "utf8", timeout: 60_000 },
    );
    assert.equal(child.status, 0, `the second interpreter compiled it too (${child.stderr})`);
    assert.equal(child.stdout, mine, "a fresh process compiles the same tiles, the same solidity and the same rows");
  }

  // ── DERIVED: NOT ONE BYTE OF THE REGISTRY REACHES THE WIRE ──────────────────
  // The whole design rests on this. A world is rebuilt from (seed, theme, brief)
  // on every load, so the registry is recomputed and never stored — and if it
  // ever leaked into the envelope it would become a format to migrate, on a
  // route that is additive by policy.
  {
    const sealed = seal([{ tag: "water-feature", name: "The Millpond" }], [wildsPlace], "village", "modest", 606);
    const w = world.build(606, "cozy-village", sealed);
    assert.ok(
      Object.values(w.zones).some((zone) => zone.features.length),
      "the world under test actually carries a registry",
    );
    const sim = new loadedPF.Sim(w);
    const snap = loadedPF.save.snapshot({ chatId: "chat-registry", sim, hud: { toast() {}, refreshChips() {} } });
    const seen = [];
    (function walk(node, path) {
      if (!node || typeof node !== "object") return;
      for (const key of Object.keys(node)) {
        if (key === "features") seen.push(`${path}.${key}`);
        walk(node[key], `${path}.${key}`);
      }
    })(snap, "snap");
    assert.deepEqual(seen, [], `the envelope carries no features key anywhere (${seen.join(", ")})`);
    assert.deepEqual(
      [...loadedPF.save._envelopeKeys].sort(),
      ["bindings", "chatId", "clockMin", "day", "facing", "intro", "player", "seed", "theme", "v", "x", "y", "zone"],
      "and ENVELOPE_KEYS is exactly what it was — the registry asked for no room",
    );
  }
}

// ── THE LEGACY NAME BOOK AND THE DEFAULT BRIEF ARE ONE VOCABULARY ────────────
// slice-1 verify F2. 20-world's ZONE_NAMES and 18-brief's DEFAULT_BRIEFS write
// the same five strings per theme, and until now a COMMENT was the only thing
// holding them together — two tables in two files, edited months apart. Driven
// from both ends: the shipped tables really do agree where a player can see it,
// and a rewrite of EITHER file fails the build rather than shipping a legacy
// world that calls the pond something the compiled one does not.
{
  // Positive half, through the readers: what buildLegacy actually names its two
  // water features is what the theme's default brief names the same two tags.
  for (const theme of ["cozy-village", "sci-fi-colony"]) {
    const legacy = world.build(77, theme, null);
    const fallback = brief.defaults(theme, 1);
    const wilds = fallback.places.find((place) => place.kind === "wilds");
    assert.equal(
      legacy.zones.village.features[0].name,
      fallback.features.find((feature) => feature.tag === "water-feature").name,
      `${theme}: the legacy pond is named out of the same book the brief uses`,
    );
    assert.equal(
      legacy.zones.forest.features[0].name,
      wilds.features.find((feature) => feature.tag === "water-crossing").name,
      `${theme}: …and so is the legacy stream`,
    );
    assert.equal(legacy.zones.village.name, fallback.name, `${theme}: …and the settlement itself`);
    assert.equal(
      legacy.zones.inn.name,
      fallback.places.find((place) => place.kind === "gathering").name,
      `${theme}: …and the inn`,
    );
    assert.equal(legacy.zones.forest.name, wilds.name, `${theme}: …and the wood`);
  }

  // Negative half: the assertion fails the build from either side of the
  // duplication. 20-world loads 18-brief's table at boot, so both files are in
  // the same forced stack and either one can be the thing that moved.
  const parts = ["00-prelude.js", "10-art.js", "15-assets.js", "18-brief.js", "20-world.js"];
  const bootWorld = (file, from, to) => {
    const source = parts
      .map((name) => {
        const text = readFileSync(join(here, "src", name), "utf8");
        if (name !== file) return text;
        const patched = text.replace(from, to);
        assert.notEqual(patched, text, `the rewrite still names ${name}'s "${from}"`);
        return patched;
      })
      .join("\n");
    return () => new Function(`"use strict";\n${source}\nreturn PF;`)();
  };
  const plainWorld = () =>
    new Function(
      `"use strict";\n${parts.map((name) => readFileSync(join(here, "src", name), "utf8")).join("\n")}\nreturn PF;`,
    )();
  assert.ok(plainWorld().world, "the stack under test boots on its own — every throw below is a rewrite talking");
  assert.throws(
    bootWorld("20-world.js", `pond: "The Village Pond"`, `pond: "The Millpond"`),
    /the legacy layout calls cozy-village's pond "The Millpond", its default brief calls it "The Village Pond"/,
    "renaming the legacy pond and not the brief fails the build",
  );
  assert.throws(
    bootWorld(
      "18-brief.js",
      `{ tag: "water-crossing", name: "The Stepping Stones" }`,
      `{ tag: "water-crossing", name: "The Ford" }`,
    ),
    /the legacy layout calls cozy-village's stream "The Stepping Stones", its default brief calls it "The Ford"/,
    "…and renaming the brief and not the legacy layout fails it from the other side",
  );
  // THE WHOLE BOOK, not only the water. The settlement, the inn and the wood are
  // the same duplication and drift the same way.
  assert.throws(
    bootWorld("20-world.js", `inn: "The Meridian Cantina"`, `inn: "The Cantina"`),
    /the legacy layout calls sci-fi-colony's inn "The Cantina", its default brief calls it "The Meridian Cantina"/,
    "the gathering place is in the book too",
  );

  // ── AND THE SAME DUPLICATION ONE TABLE ALONG: THE FOUR RESIDENTS' ROLES ─────
  // buildLegacy hardcoded "innkeeper", "farmer", "village guard" and "forager"
  // theme-blind, right beside a ZONE_NAMES that has been themed since 0.4.0. It
  // was invisible while a role was only ever a token's label; slice 3's no-rod
  // refusal made it player-facing, because that sentence interpolates npc.role —
  // so a legacy sci-fi colony was telling the player "You need an angling rig —
  // the innkeeper stocks one", in a world with no inn anywhere in it.
  //
  // Same bug class as the names above and pinned the same way, in both
  // directions. The four names are the anchor: buildLegacy stands up Mira, Tam,
  // Rook and Fen, and so does every theme's default brief.
  for (const theme of ["cozy-village", "sci-fi-colony"]) {
    const legacy = world.build(77, theme, null);
    const fallback = brief.defaults(theme, 1);
    const residents = Object.values(legacy.zones).flatMap((zone) => zone.npcs);
    assert.equal(residents.length, 4, `${theme}: the legacy layout stands its four people up`);
    for (const npc of residents) {
      const member = fallback.cast.find((cast) => cast.name === npc.name);
      assert.ok(member, `${theme}: ${npc.name} is in the default brief's cast as well`);
      assert.equal(npc.role, member.role, `${theme}: the legacy ${npc.name} does the job the brief gives them`);
    }
  }

  // AND WHAT IT REACHES THE PLAYER AS, which is the whole reason this is worth a
  // table rather than a comment. Driven through the shipped refusal on a LEGACY
  // colony — the world the compiled-world case further down could not see.
  {
    const colony = new loadedPF.Sim(world.build(77, "sci-fi-colony", null));
    const hint = loadedPF.economy.rodHint({ chatId: "chat-legacy-role", sim: colony, hud: { toast() {} } });
    assert.ok(!/innkeeper/.test(hint), `a legacy colony has no innkeeper to send anyone to (${hint})`);
    assert.ok(/cantina keeper/.test(hint), `…it has the person its own brief names (${hint})`);
  }

  assert.throws(
    bootWorld("20-world.js", `Mira: "cantina keeper"`, `Mira: "barkeep"`),
    /the legacy layout makes sci-fi-colony's Mira a "barkeep", its default brief makes them a "cantina keeper"/,
    "rewriting the legacy role and not the brief fails the build",
  );
  // The brief-side rewrite has to name the DEFAULT_BRIEFS entry and not the
  // STOCK_CAST row above it, which writes the same four roles a second time and
  // would swallow a single-line rewrite: the assertion reads defaults(), so a
  // patch that missed it would report "no exception" and mean nothing.
  assert.throws(
    bootWorld(
      "18-brief.js",
      `name: "Rook",\n          role: "pad marshal",`,
      `name: "Rook",\n          role: "landing marshal",`,
    ),
    /the legacy layout makes sci-fi-colony's Rook a "pad marshal", its default brief makes them a "landing marshal"/,
    "…and rewriting the brief and not the legacy layout fails it from the other side",
  );
}

// ── THE CAST WINDOW'S CLOCK MOVER CROSSES MIDNIGHT ───────────────────────────
// `advanceMinutes` is the fishing verb's mover and it is the only one in the sim
// that can be more than a minute out of date about the day. The walking loop
// ticks one minute at a time and can never overshoot; a cast window is fifteen
// at once, and "fish until dawn" from a night spot is a session that is SUPPOSED
// to cross into tomorrow. Without the wrap the clock reads 24:05 on day one, the
// daypart word falls off the end of its own table, and the ledger files the
// morning's catch under the night before it.
{
  const w = world.build(4242, "cozy-village");
  const sim = new loadedPF.Sim(w);

  sim.clockMin = 10 * 60;
  sim.day = 3;
  assert.equal(sim.advanceMinutes(15), 15, "an ordinary window reports the minutes it spent");
  assert.equal(sim.clockMin, 10 * 60 + 15, "…and spends exactly those");
  assert.equal(sim.day, 3, "inside one day, the day does not move");

  // THE WRAP. 23:50 plus a fifteen-minute window is 00:05 tomorrow.
  sim.clockMin = 23 * 60 + 50;
  sim.day = 3;
  sim.advanceMinutes(15);
  assert.equal(sim.day, 4, "a window that crosses midnight moves the day");
  assert.ok(sim.clockMin < 24 * 60, `…and the clock came back inside the day (${sim.clockMin})`);
  assert.equal(sim.clockMin, 5, "…at five past midnight, not twenty-four-oh-five");
  assert.equal(sim.daypart(), "night", "…which the daypart table can still answer for");

  // A LOOP AND NOT A TEST: a jump longer than a day wraps as many times as it
  // takes. Nothing on the verb's menu does this today, and a single `if` that
  // silently left the clock at 26:00 would be waiting for the first thing that
  // did.
  sim.clockMin = 12 * 60;
  sim.day = 1;
  sim.advanceMinutes(3 * 24 * 60 + 30);
  assert.equal(sim.day, 4, "three days and a half-hour is three days on");
  assert.equal(sim.clockMin, 12 * 60 + 30, "…and half an hour past noon");

  // SCHEDULES RESOLVE UNCONDITIONALLY, which is what the wrap is FOR: a night
  // cast that lands after dawn must find the world's people where dawn puts
  // them, not where midnight left them. A COMPILED world, because the legacy
  // cast carries no schedules at all and would prove this vacuously.
  {
    const fresh = new loadedPF.Sim(world.build(4242, "cozy-village", brief.defaults("cozy-village", 4242)));
    fresh.clockMin = 23 * 60 + 55;
    fresh.day = 1;
    fresh.resolveSchedules();
    const census = () =>
      Object.entries(fresh.world.zones)
        .flatMap(([id, zone]) => zone.npcs.map((npc) => `${npc.id}@${id}:${Math.round(npc.x)},${Math.round(npc.y)}`))
        .sort();
    const asleep = census();
    assert.ok(asleep.length > 4, `the compiled world has a cast to re-place (${asleep.length})`);
    fresh.advanceMinutes(7 * 60); // 06:55 the next morning: night → dawn
    assert.equal(fresh.day, 2, "the jump crossed the day");
    assert.equal(fresh._daypart, "dawn", "…and the sim knows which daypart it landed in");
    assert.notDeepEqual(census(), asleep, "…because the cast re-placed everybody for it");
  }

  // AND A NON-COUNT MOVES NOTHING. The verb passes TUNING.castMinutes, but the
  // mover is public and a caller that hands it nonsense must not leave the clock
  // at NaN — every daypart read and every save byte downstream is a number.
  sim.clockMin = 60;
  sim.day = 2;
  for (const bad of [0, -15, 1.5, "15", undefined, null, NaN, Infinity]) {
    assert.equal(sim.advanceMinutes(bad), 0, `${String(bad)} is not a count of minutes`);
    assert.equal(sim.clockMin, 60, "…and the clock did not move for it");
    assert.equal(sim.day, 2, "…nor the day");
  }

  // THE FRACTION UNDER THE CLOCK IS LEFT ALONE, which is the stated deviation
  // between this mover and waitUntil one method up. waitUntil CLEARS `_clockAcc`
  // because it jumps to a target, and a leftover fraction would tick that
  // target's own minute early. An advance lays whole minutes on top of a
  // fraction the player has genuinely already walked off, so clearing it would
  // quietly lose those seconds: a cast taken mid-stride would reset the walking
  // cadence, and the minute the player was most of the way through would start
  // over. Observable, and observed rather than asserted about the field alone —
  // the fraction still buys the minute it was owed on the very next step.
  {
    const walker = new loadedPF.Sim(w);
    walker.mode = "walk";
    walker.clockMin = 60;
    walker.day = 2;
    const perMinute = loadedPF.CLOCK_SECONDS_PER_GAME_MINUTE;
    const walked = perMinute * 0.9; // nine tenths of a game minute already on foot
    walker._clockAcc = walked;
    walker.advanceMinutes(15);
    assert.equal(walker._clockAcc, walked, "a cast spends whole minutes and does not touch the fraction under them");
    assert.equal(walker.clockMin, 75, "…while spending every one of the whole ones");
    walker.step(perMinute * 0.2, {}); // two tenths more: over the line, with a cast in between
    assert.equal(walker.clockMin, 76, "the walked fraction still buys the minute it was owed");
    // …AND waitUntil IS THE OTHER SIDE OF THE DEVIATION, so the difference is a
    // decision rather than a thing one of them forgot.
    walker._clockAcc = walked;
    walker.waitUntil("dusk");
    assert.equal(walker._clockAcc, 0, "a JUMP does clear it, because it lands on a target rather than past one");
  }
}

// ═══ S4 ACTIVATION: THE LADDER, THE RESOLVERS, THE TUNING TABLE (0.12 s2) ════
// Constants and pure reads, so the cases are constants and pure reads too: no
// world, no save path, no clock. What they pin is the ground the fishing verb
// gets built on — that a saved string can never leave the range its resolver
// promises, that the quality ladder grades TOOLS and leaves every other `k`
// alone, and that the load-time assertions actually fail a build.

// ── THE RESOLVERS: A SAVED STRING IS EVIDENCE, NEVER A VALUE ─────────────────
{
  const P = loadedPF.player;

  assert.deepEqual(
    [...P.QUALITY],
    ["crude", "decent", "fine", "masterwork"],
    "the ladder is ordered worst to best — the index IS the tier",
  );
  assert.ok(Object.isFrozen(P.QUALITY), "…and frozen: every save in the wild was written against those positions");
  assert.deepEqual(
    P.QUALITY.map((k) => P.resolvedToolTier(k)),
    [0, 1, 2, 3],
    "each rung resolves to its own place on it",
  );
  assert.equal(P.resolvedToolTier("legendary"), 0, "a tier no ladder names is CRUDE — not a throw, and not a bonus");
  assert.equal(P.resolvedToolTier(""), 0, "so is a row carrying no quality at all");
  assert.equal(P.resolvedToolTier(undefined), 0, "…and so is no field");
  assert.equal(P.resolvedToolTier(2), 0, "a number is not a rung: the ladder is read by NAME");
  assert.equal(P.resolvedToolTier("Crude"), 0, "and the names are exact — a near miss is a miss");

  // PRESENCE, WHICH IS THE WHOLE REASON THIS IS A SECOND RESOLVER. Bait `k` are
  // semantic slugs, so an index read maps a slotted bait and an EMPTY slot onto
  // the same 0 and the modifier is inert either way. The first pair of lines is
  // that seam, stated rather than described.
  const slot = ["bait", "worms"];
  const stocked = { t: "bait", q: 3, k: "worms" };
  assert.equal(P.resolvedToolTier("worms"), P.resolvedToolTier(""), "an index read cannot tell bait from no bait…");
  assert.equal(P.resolvedModTier(slot, stocked), 1, "…while presence can: slotted, and stocked behind it");
  assert.equal(P.resolvedModTier(null, stocked), 0, "an empty slot is no modifier, stack or no stack");
  assert.equal(P.resolvedModTier(slot, { t: "bait", q: 0, k: "worms" }), 0, "a spent stack backs nothing");
  assert.equal(P.resolvedModTier(slot, undefined), 0, "and neither does a row the pouch no longer holds");
  assert.equal(P.resolvedModTier(slot, { t: "bait", q: 9, k: "grubs" }), 0, "nor a full stack of something ELSE");
  assert.equal(P.resolvedModTier(slot, 2), 1, "a bare count is enough for a caller that already has one");
  assert.equal(P.resolvedModTier(slot, 0), 0, "…and the same count at zero is the same refusal");
  assert.equal(P.resolvedModTier(["", ""], 5), 0, "a pair with no type is not a pair");

  assert.equal(P.resolvedLevel({ l: 7, x: 3 }), 7, "an ordinary skill row reads as itself");
  assert.equal(P.resolvedLevel({ l: 0 }), 1, "the floor is 1 — a verb nobody has used still rolls, at the bottom");
  assert.equal(P.resolvedLevel({ l: 9000 }), P.CAPS.skillLevel, "and the ceiling is the ladder the block can hold");
  assert.equal(P.resolvedLevel({ l: -4 }), 1, "a negative level is not a level");
  assert.equal(P.resolvedLevel({ l: "12" }), 1, "…and neither is a string one");
  assert.equal(P.resolvedLevel(undefined), 1, "a verb with no row at all is level 1");
  assert.equal(P.resolvedLevel(11), 11, "a bare number is taken, for a caller that already read the row");
}

// ── THE LADDER GRADES TOOLS, AND LEAVES EVERY OTHER `k` ALONE ────────────────
// One field, two vocabularies. `k` is a QUALITY rung on a tool and a semantic
// SLUG on everything else — a catch's variant, a bait's kind — so the validator
// has to be scoped by type or "kelp" becomes a badly-spelled "crude".
{
  const P = loadedPF.player;
  const core = { chatId: "chat-quality", sim: { player: P.defaultPlayer(), dirty: false } };
  try {
    assert.equal(P.grant(core, { t: "rod", k: "legendary" }, 1), 0, "a graded row off the ladder is refused outright");
    assert.deepEqual(core.sim.player.pouch.items, [], "…and nothing was minted on the way to refusing it");
    assert.equal(P.grant(core, { t: "rod", k: "" }, 1), 0, "an ungraded rod is the same refusal — a tool has a tier");
    assert.equal(P.grant(core, { t: "rod", k: "decent" }, 1), 1, "and a rung is taken");

    assert.equal(P.grant(core, { t: "catch-common", k: "kelp" }, 2), 2, "a variant slug is a variant, not a bad tier");
    assert.equal(P.grant(core, { t: "bait", k: "worms" }, 5), 5, "…and bait keeps its own kind for the same reason");
    assert.equal(P.grant(core, "lodging-key", 1), 1, "the one shipped keyless row is untouched by any of this");

    // equip() applies the same rule at the same point — before it allocates.
    assert.equal(
      P.equip(core, "fishing", "tool", { t: "rod", k: "legendary" }),
      false,
      "a slot cannot point at a row the pouch would refuse to hold",
    );
    assert.equal(core.sim.player.skills.equipped.fishing, undefined, "…and the refusal left no verb bucket behind");
    assert.equal(P.equip(core, "fishing", "tool", { t: "rod", k: "decent" }), true, "a graded pair equips");
    assert.equal(P.equip(core, "fishing", "mod", { t: "bait", k: "worms" }), true, "an ungraded one equips freely");

    // …which closes the loop: what equip() wrote is what the resolvers read.
    const equipped = core.sim.player.skills.equipped.fishing;
    assert.equal(P.resolvedToolTier(equipped.tool[1]), 1, "the equipped rod resolves to its own rung");
    const stack = core.sim.player.pouch.items.find((it) => it.t === "bait" && it.k === "worms");
    assert.equal(P.resolvedModTier(equipped.mod, stack), 1, "and the slotted bait resolves to a present modifier");

    // THE WIRE IS NOT VALIDATED, ON PURPOSE. The rule belongs to the mutators:
    // a save already carrying a rod nobody can mint any more must round-trip
    // untouched and resolve to the floor, not vanish out of the player's pouch.
    const hostile = P.serialize({
      ...P.defaultPlayer(),
      pouch: { money: 0, items: [{ t: "rod", q: 1, k: "legendary" }] },
    });
    assert.equal(hostile.pouch.items[0].k, "legendary", "a hostile quality survives serialization exactly as written");
    assert.equal(P.resolvedToolTier(hostile.pouch.items[0].k), 0, "…and is read as crude every time it is read");
  } finally {
    loadedPF.save.reset(); // the mutators self-dirty, and a dirty block arms a timer
  }
}

// ── THE LOAD-TIME ASSERTIONS ACTUALLY FAIL THE BUILD ─────────────────────────
// An assertion nobody has watched fail is a comment with a throw in it. Each
// case rewrites ONE invariant in the source and re-loads the stack the economy's
// boot block needs, which is the forced-load idiom this file already uses on
// 20-world's host resolution — and each rewrite is asserted to have LANDED, so a
// case cannot pass green because the line it meant to break moved.
{
  const stack = ["00-prelude.js", "10-art.js", "58-player.js", "59-economy.js"];
  const boot = (file, from, to) => {
    const source = stack
      .map((name) => {
        const text = readFileSync(join(here, "src", name), "utf8");
        if (name !== file) return text;
        const patched = text.replace(from, to);
        assert.notEqual(patched, text, `the rewrite still names ${file}'s "${from}"`);
        return patched;
      })
      .join("\n");
    return () => new Function(`"use strict";\n${source}\nreturn PF;`)();
  };
  const plain = () =>
    new Function(
      `"use strict";\n${stack.map((name) => readFileSync(join(here, "src", name), "utf8")).join("\n")}\nreturn PF;`,
    )();
  assert.ok(plain().economy.TUNING, "the stack under test boots on its own — every throw below is a rewrite talking");

  // (a) EVERY (theme, tier) THE LADDER CAN QUOTE HAS A PRICE. A missing one
  // reaches the player as the keeper refusing the sale, which is what a world
  // that deliberately stocks nothing looks like too. KEY EXISTENCE ONLY: nothing
  // couples these numbers to the purse or the berth (maintainer override).
  assert.throws(
    boot("59-economy.js", `, "rod:decent": 40`, ``),
    /theme "cozy-village" has no price for a decent rod/,
    "a rung the ladder quotes and the table does not price fails the build",
  );
  assert.throws(
    boot("59-economy.js", `const ROD_TIERS = ["crude", "decent"]`, `const ROD_TIERS = ["crude", "legendary"]`),
    /the rod ladder quotes "legendary", which is not a quality tier/,
    "…and so does a rung that is not on the ladder at all",
  );
  for (const theme of loadedPF.art.themeIds()) {
    for (const tier of loadedPF.economy.ROD_TIERS) {
      assert.equal(
        typeof loadedPF.economy.price({ theme }, loadedPF.economy.rodPriceKey(tier)),
        "number",
        `${theme} quotes a ${tier} rod through the shipped price reader`,
      );
    }
  }

  // (b) THE TELL'S FLOOR. Under one maximum-shape day the tell renders zero
  // whole days, the burn advances through nothing, and the flush stalls for the
  // rest of the save.
  const maxShapeDay = loadedPF.player.CAPS.ledgerPerDay * loadedPF.player.CAPS.ledgerChars;
  assert.equal(maxShapeDay, 3000, "one max-shape ledger day is 15 lines of 200 graphemes");
  assert.ok(loadedPF.economy.TUNING.ledgerTellChars >= maxShapeDay, "and the shipped budget clears it");
  assert.throws(
    boot("59-economy.js", "ledgerTellChars: 3000", "ledgerTellChars: 2999"),
    /TUNING\.ledgerTellChars \(2999\) is under one max-shape ledger day \(3000\)/,
    "one grapheme under the floor fails the build",
  );

  // (c) THE XP TABLE IS THE SINGLE AUTHORITY, so a type missing from it is a
  // yield that awards nothing — and the likeliest one to go missing is `bait`,
  // which is the yield a fresh player meets first.
  assert.throws(
    boot("59-economy.js", `[BAIT_TYPE]: 1`, `_notbait: 1`),
    /TUNING\.catchXp has no xp for "bait"/,
    "bait pays through the same table or the build stops",
  );
  assert.throws(
    boot("59-economy.js", `"catch-rare": 5`, `"catch-rarely": 5`),
    /TUNING\.catchXp has no xp for "catch-rare"/,
    "…and so does every one of the four roles",
  );

  // (d) THE LADDER AND ITS MULTIPLIERS ARE TWO LISTS IN TWO FILES indexed by one
  // resolved number. Pinned from BOTH ends: a short multiplier list hands the
  // curve `undefined` on the best rod in the game, and a lengthened ladder does
  // the same thing without either file being edited.
  assert.throws(
    boot("59-economy.js", "toolMult: [1, 1.15, 1.3, 1.45]", "toolMult: [1, 1.15, 1.3]"),
    /TUNING\.toolMult has 3 multipliers for 4 quality tiers/,
    "a multiplier short of the ladder fails the build",
  );
  assert.throws(
    boot("58-player.js", `"fine", "masterwork"]`, `"fine", "masterwork", "mythic"]`),
    /TUNING\.toolMult has 4 multipliers for 5 quality tiers/,
    "…and a rung added to the ladder fails it from the other side",
  );

  // (e) THE CATCH TABLES AND THE WORDS FOR WHAT THEY YIELD (0.12 slice 3). Same
  // idiom, and one of these needs two rewrites at once — a theme's bait lives in
  // two tables, so killing it takes both.
  const bootAll = (edits) => {
    const source = stack
      .map((name) => {
        let text = readFileSync(join(here, "src", name), "utf8");
        for (const [file, from, to] of edits) {
          if (file !== name) continue;
          const patched = text.replace(from, to);
          assert.notEqual(patched, text, `the rewrite still names ${name}'s "${from}"`);
          text = patched;
        }
        return text;
      })
      .join("\n");
    return () => new Function(`"use strict";\n${source}\nreturn PF;`)();
  };

  // EVERY VARIANT, IN EVERY THEME. The pouch is world-free, so a fish caught in a
  // valley is still in the bag when the chat's next world is a colony — and a row
  // with no word there would fall to the slug fallback that exists for a HOSTILE
  // save, not for content this build ships.
  assert.throws(
    boot("59-economy.js", `"culture-kelp": "strange kelp"`, `"culture-kelp-x": "strange kelp"`),
    /theme "cozy-village" has no name for "culture-kelp"/,
    "a variant one theme fishes and the other cannot name fails the build",
  );
  // …AND THE 2×2 ITSELF, from the vocabulary side: a spot kind with no table is
  // water the player can stand at and the verb cannot answer for.
  assert.throws(
    boot(
      "59-economy.js",
      `const SPOT_TAGS = ["water-feature", "water-crossing"]`,
      `const SPOT_TAGS = ["water-feature", "water-crossing", "dense-growth"]`,
    ),
    /theme "cozy-village" has no catch table for "dense-growth"/,
    "a spot kind the vocabulary names and no table answers for fails the build",
  );
  // A ROLE HAS TO BE A ROLE. A typo mints a pouch row of a type nothing skins,
  // nothing prices and the xp table cannot pay for — and it looks exactly like
  // the deliberate roleless entry that means bait.
  assert.throws(
    boot("59-economy.js", `role: "catch-prize", variant: "old-tench"`, `role: "catch-prizes", variant: "old-tench"`),
    /cozy-village\/water-feature has an entry with the role "catch-prizes"/,
    "a misspelled role fails the build rather than shipping as bait",
  );
  // AN ENTRY NOBODY CAN EVER DRAW. The draw is a level test and the level stops
  // at the ceiling, so a minLevel above it is written content no save can reach.
  assert.throws(
    boot(
      "59-economy.js",
      `variant: "old-tench", weight: 2, minLevel: 12`,
      `variant: "old-tench", weight: 2, minLevel: 21`,
    ),
    /cozy-village\/water-feature's "old-tench" needs level 21, outside 1\.\.20/,
    "an entry gated above the skill ceiling fails the build",
  );
  // A DAYPART COLUMN THAT NEVER APPLIES, which is the failure that looks most
  // like a tuned one: a plausible word, silently multiplying nothing forever.
  assert.throws(
    boot("59-economy.js", `daypart: { dawn: 2, day: 0.5 }`, `daypart: { evening: 2, day: 0.5 }`),
    /cozy-village\/water-feature's "old-tench" is tuned for a daypart "evening"/,
    "a daypart the clock does not have fails the build",
  );
  // AND A THEME WITH NO BAIT IN ITS WATER would sell a rod and hand over an empty
  // tin: the crude purchase's starter stack takes its slug from exactly here.
  assert.throws(
    bootAll([
      ["59-economy.js", `{ variant: "worms", weight: 24`, `{ role: "catch-common", variant: "worms", weight: 24`],
      ["59-economy.js", `{ variant: "grubs", weight: 22`, `{ role: "catch-common", variant: "grubs", weight: 22`],
    ]),
    /theme "cozy-village" ships no bait entry for a first rod to come with/,
    "a theme whose water yields no bait fails the build",
  );
  // A SLUG WITH THE LEDGER'S OWN SEPARATOR IN IT. _logDay counts a session's
  // yields in a Map keyed `${type}:${variant}` and splits that key apart again to
  // name them, so a variant carrying a ":" is TRUNCATED at it — a "sea:bass"
  // renders as "sea", and the wrap-up tells the player about a thing that does
  // not exist. Closed at boot rather than by escaping the key, because a slug
  // with punctuation in it is content nobody needs and the encoding is one line
  // shorter for never having to survive one.
  // Renamed in its table AND in both themes' word lists, so the variant-skin
  // assertion above is satisfied and the slug check is what is left to fail.
  assert.throws(
    bootAll([
      ["59-economy.js", `variant: "mirror-pike"`, `variant: "mirror:pike"`],
      ["59-economy.js", `"mirror-pike": "mirror pike"`, `"mirror:pike": "mirror pike"`],
      ["59-economy.js", `"mirror-pike": "mirror pike"`, `"mirror:pike": "mirror pike"`],
    ]),
    /cozy-village\/water-feature's "mirror:pike" has a ":" in its slug, which is the ledger's own separator/,
    "a variant slug carrying the ledger key's separator fails the build",
  );
}

// ═══ SLICE 3: WHAT THE WATER GIVES UP, AND WHAT IT IS CALLED ════════════════
// The tables and the vocabulary, driven through the READERS — which is the half
// a load assertion cannot make. A table that satisfies every completeness check
// and still renders a carp as "catch-common" passes the boot block and fails
// here.
{
  const E = loadedPF.economy;

  // ── THE 2×2 IS REAL, AND EVERY TABLE SPANS THE LADDER ───────────────────────
  // (theme × spot kind). Still water and running water fish differently in any
  // theme, which is the whole reason the key has two halves.
  for (const theme of loadedPF.art.themeIds()) {
    const w = { theme };
    for (const tag of E.SPOT_TAGS) {
      const table = E.catchTable(w, tag);
      assert.ok(Array.isArray(table) && table.length, `${theme}/${tag} answers with a table`);
      const types = new Set(table.map((entry) => E.entryType(entry)));
      assert.ok(types.has(E.BAIT_TYPE), `${theme}/${tag} yields bait — fishing is bait's own finder`);
      for (const role of E.CATCH_ROLES) assert.ok(types.has(role), `${theme}/${tag} reaches ${role}`);
      // A LEVEL-1 PLAYER CAN DRAW SOMETHING. Every entry is gated by minLevel, so
      // a table whose cheapest rung sat at level 3 would be water that answers
      // nothing at all to the player who has just bought their first rod.
      assert.ok(
        table.some((entry) => entry.minLevel === 1),
        `${theme}/${tag} has something in it for a player on their first day`,
      );
      // The prize rung is the top of the same table, not a second one.
      const prize = table.find((entry) => entry.role === "catch-prize");
      assert.ok(prize.minLevel > 1 && prize.weight < 5, `${theme}/${tag}'s prize is late and rare (${prize.variant})`);
    }
  }
  assert.equal(E.catchTable({ theme: "cozy-village" }, "crop-plots"), null, "a tag that holds no water has no table");
  assert.equal(E.catchTable({ theme: "cozy-village" }, "constructor"), null, "…and neither does one off the prototype");
  assert.deepEqual(
    E.catchTable({ theme: "retired-theme" }, "water-feature"),
    E.catchTable({ theme: "cozy-village" }, "water-feature"),
    "a save naming a theme this build dropped still fishes, in the fallback theme's water",
  );

  // ── SCI-FI FISHES FOR REAL FISH (M6 RULED) ──────────────────────────────────
  // The ruling is content, so it is pinned as content: the colony's tables carry
  // fish the valley's tables carry too, flavored variants of its own, AND yields
  // that are not fish at all. All three, or the theme is a re-skin.
  {
    const variantsOf = (theme) =>
      new Set(E.SPOT_TAGS.flatMap((tag) => E.catchTable({ theme }, tag).map((entry) => entry.variant)));
    const cozy = variantsOf("cozy-village");
    const scifi = variantsOf("sci-fi-colony");
    const shared = [...scifi].filter((variant) => cozy.has(variant));
    assert.ok(shared.length >= 2, `the colony fishes for real fish the valley knows too (${shared.join(", ")})`);
    assert.ok(shared.includes("carp"), "…carp among them: a stocked pool is stocked with something");
    for (const flavored of ["vat-strain", "pressure-eel"])
      assert.ok(scifi.has(flavored) && !cozy.has(flavored), `${flavored} is the colony's own`);
    for (const notAFish of ["culture-kelp", "filter-salvage"])
      assert.ok(scifi.has(notAFish), `${notAFish} is a legitimate entry, not a consolation prize`);
  }

  // ── describe(): THE NAME KEYS ON THE VARIANT ────────────────────────────────
  // A pouch row is `{t: role, k: variant}` and the ROLE is not what the thing is
  // called. Without this the player's bag reads "catch-common ×3".
  {
    const cozy = { theme: "cozy-village", seed: 0 };
    const scifi = { theme: "sci-fi-colony", seed: 0 };
    const plain = (world, item) => {
      const named = E.describe(world, item);
      const flourish = E._flourish(world, item.t, item.k ?? "");
      return flourish ? named.slice(flourish.length + 1) : named;
    };
    assert.equal(plain(cozy, { t: "catch-common", k: "carp" }), "carp", "a catch reads as its variant");
    assert.equal(plain(cozy, { t: "catch-rare", k: "mirror-pike" }), "mirror pike", "…whatever rung it sits on");
    assert.equal(plain(cozy, { t: "bait", k: "worms" }), "worms", "and bait does too — never 'worms bait'");
    assert.ok(
      !E.describe(cozy, { t: "bait", k: "worms" }).includes("hook bait"),
      "…the type's own word stays out of it",
    );
    // THEME-BEARING, one level down from the type names: the same row reads in
    // the words of whatever world the chat is in now, because the pouch crosses
    // world changes and the row does not get renamed under the player.
    assert.notEqual(
      plain(cozy, { t: "catch-common", k: "culture-kelp" }),
      plain(scifi, { t: "catch-common", k: "culture-kelp" }),
      "the colony's kelp is called something else in a valley",
    );
    assert.equal(plain(scifi, { t: "catch-common", k: "carp" }), "carp", "…while a carp is a carp in either");

    // AN UNKNOWN VARIANT RENDERS SLUG-DERIVED — a hostile save row, or a newer
    // build's table — matching describe()'s unknown-TYPE philosophy exactly.
    // Cosmetic, never a throw, and never a row that vanishes out of the bag.
    assert.equal(
      plain(cozy, { t: "catch-rare", k: "moon_carp-two" }),
      "moon carp two",
      "an unknown variant still reads",
    );
    assert.equal(plain(cozy, { t: "catch-rare", k: "constructor" }), "constructor", "…including one off the prototype");
    assert.equal(
      E.describe(cozy, { t: "catch-common", k: "" }),
      E.describe(cozy, { t: "catch-common" }),
      "and a catch row carrying no variant falls back to its type's own word",
    );
  }

  // ── THE FLOURISH IS A DISPLAY OVERRIDE, KEYED (seed, t, k) ──────────────────
  // Pouch rows MERGE — one carp row holding nine carp — so a per-catch epithet
  // has nothing to live on. Per world per variant is the shape the data can
  // carry: this valley's carp are the muddy ones, the next world's are not.
  {
    const one = { theme: "cozy-village", seed: 4242 };
    const same = { theme: "cozy-village", seed: 4242 };
    const other = { theme: "cozy-village", seed: 99 };
    const carp = { t: "catch-common", k: "carp" };
    assert.equal(E.describe(one, carp), E.describe(same, carp), "one world, one epithet, every time it is read");
    assert.notEqual(E.describe(one, carp), E.describe(one, { t: "catch-common", k: "minnow" }), "…per variant");
    const seeds = new Set(
      [4242, 99, 7, 13, 2095930824].map((seed) => E.describe({ theme: "cozy-village", seed }, carp)),
    );
    assert.ok(seeds.size > 1, `and different worlds do not all fish the same carp (${[...seeds].join(" / ")})`);
    assert.notEqual(E._flourish(other, "catch-prize", "old-tench"), "", "the prize rung has a pool of its own");
    // SKIN-NAME FALLBACK: a type with no pool reads plainly. Rods and bait ship
    // none, so nothing in the shop window has a mood.
    for (const type of ["rod", "bait", "lodging-key"])
      assert.equal(E._flourish(one, type, "crude"), "", `${type} has no pool and reads plainly`);
    assert.equal(E.describe(one, { t: "rod", k: "crude" }), "crude fishing rod", "…which is what a rod reads as");
    // A world with no seed at all (the wizard's throwaway, a bare `{theme}`)
    // still renders rather than keying off undefined.
    assert.ok(E.describe({ theme: "cozy-village" }, carp).endsWith("carp"), "a seedless world still names its fish");
  }

  // ── THE STARTER STACK MERGES WITH WHAT THE PLAYER THEN FISHES UP ────────────
  // Its slug is the theme's FIRST bait variant, scanned in SPOT_TAGS order, so
  // the tin the rod came with and the tin filled out of the pond are one row.
  for (const theme of loadedPF.art.themeIds()) {
    const slug = E.starterBait({ theme });
    const firstTable = E.catchTable({ theme }, E.SPOT_TAGS[0]);
    const firstBait = firstTable.find((entry) => E.entryType(entry) === E.BAIT_TYPE);
    assert.equal(slug, firstBait.variant, `${theme}'s starter bait is the first bait its own water yields`);
    assert.ok(E.describe({ theme }, { t: E.BAIT_TYPE, k: slug }), `${theme} names it`);
  }
  assert.equal(E.starterBait({ theme: "cozy-village" }), "worms", "which in a valley is worms");
}

// ── THE KEEPER SELLS TWO THINGS, AND RESOLVES THE SAME WAY FOR BOTH ──────────
// M8's amendment: no rod is ever free, and the person who lets the room is the
// person who sells the rod. Their resolution — reach first, then the room — is
// now ONE helper both offers call, because a second copy of that line is a build
// where the innkeeper lets you a room from across the counter and refuses to
// sell you a rod from the same spot.
{
  const E = loadedPF.economy;
  const P = loadedPF.player;
  const sealed = brief.validate(
    {
      scale: "village",
      name: "Fallowmere",
      prosperity: "modest",
      backgroundPopulation: 40,
      situation: "The bridge went in the spring flood and the ford is the only way across.",
      cast: [
        { name: "Perrin Quill", role: "innkeep", kind: "host", tint: "amber", home: "Fallowmere", household: 1 },
        { name: "Wren Ash", role: "miller", kind: "maker", tint: "teal", home: "Fallowmere", household: 2 },
      ],
    },
    { theme: "cozy-village", seed: 8080 },
  );
  const w = world.build(8080, "cozy-village", sealed);
  let keeper = null;
  let keeperZone = null;
  let bystander = null;
  for (const zoneId of Object.keys(w.zones)) {
    for (const npc of w.zones[zoneId].npcs) {
      if (typeof npc.lodging === "string" && !keeper) {
        keeper = npc;
        keeperZone = zoneId;
      } else if (!npc.lodging && !bystander) bystander = npc;
    }
  }
  assert.ok(keeper && bystander, "the compiled world has somebody who lets rooms and somebody who does not");
  const room = w.zones[keeper.lodging];
  if (!room.npcs.includes(keeper)) room.npcs.push(keeper); // the daypart may have them out; the room path is the case

  const fresh = (chatId) => {
    const sim = new loadedPF.Sim(w);
    return { chatId, sim, hud: { toast() {}, refreshChips() {} }, markDirty() {} };
  };
  const stand = (core, zoneId, npc) => {
    core.sim.zoneId = zoneId;
    core.sim.nearNpc = npc;
  };

  try {
    // ── THE SHARED RESOLUTION, on both paths and on neither ───────────────────
    {
      const core = fresh("chat-keeper-shared");
      P.award(core, { money: 200 });
      stand(core, w.startZone, bystander);
      assert.equal(E.berthOffer(core).keeper, null, "out in the square by a villager, no berth");
      assert.equal(E.rodOffer(core).keeper, null, "…and no rod either — one resolution, one answer");
      assert.equal(E.rodOffer(core).reason, "no-keeper", "with the same reason the berth gives");

      stand(core, keeperZone, keeper); // REACH: standing next to them, wherever that is
      assert.equal(E.berthOffer(core).keeper, keeper, "in reach of the keeper, the berth is offered");
      assert.equal(E.rodOffer(core).keeper, keeper, "…and so is the rod, by the same person");

      stand(core, keeper.lodging, bystander); // ROOM: inside the inn, nearest to somebody else
      assert.equal(E.berthOffer(core).keeper, keeper, "inside the room, the room answers for the berth");
      assert.equal(E.rodOffer(core).keeper, keeper, "…and for the rod, which is the drift this helper prevents");
    }

    // ── NO PLAYER BLOCK, AND BOTH OFFERS SAY SO IN THEIR OWN WORD ─────────────
    // Not reachable in play — Sim's constructor default-initialises the block and
    // every restore path overwrites it — and that is exactly why these two lines
    // needed watching: both offers resolve the keeper FIRST and read the pouch
    // two lines later, so with the guard gone they walk past a perfectly good
    // keeper and dereference null. The fishing verb's seventh value is pinned the
    // same way further down; these were the two guards doing the same job with
    // nobody looking at them.
    //
    // The staged keeper is the whole fixture. Standing somewhere nobody lets
    // rooms would refuse for "no-keeper" long before the block is read, and the
    // case would pass with the guard deleted.
    {
      const core = fresh("chat-keeper-no-player");
      stand(core, keeperZone, keeper);
      assert.equal(E.berthOffer(core).keeper, keeper, "the fixture is standing at a keeper, block and all");
      core.sim.player = null;
      const berth = E.berthOffer(core);
      assert.equal(berth.available, false, "no block, no berth");
      assert.equal(berth.reason, "no-player", "…and the value names the BLOCK, not the person in front of you");
      assert.equal(berth.keeper, null, "…so nothing half-built comes back with it");
      const rod = E.rodOffer(core);
      assert.equal(rod.available, false, "no block, no rod either");
      assert.equal(rod.reason, "no-player", "…in the same word, from the same shape");
      assert.equal(rod.tier, null, "…quoting no rung, because there is nobody to quote one to");
    }

    // ── THE LADDER: no rod → crude → decent → the button is gone ──────────────
    {
      const core = fresh("chat-rod-ladder");
      stand(core, keeperZone, keeper);
      P.award(core, { money: 200 });

      const first = E.rodOffer(core);
      assert.equal(first.tier, "crude", "a rodless player is quoted the entry rung");
      assert.equal(first.price, E.price(w, E.rodPriceKey("crude")), "at the theme's own price for it");
      assert.equal(first.available, true, "and can take it");

      const bought = E.buyRod(core);
      assert.equal(bought.ok, true, "the sale goes through");
      assert.equal(bought.tier, "crude", "…of the rung that was quoted");
      assert.deepEqual(
        Object.keys(bought).sort(),
        ["bait", "ok", "price", "reason", "tier"],
        "and the sale's shape is the one every other return of this verb carries",
      );
      const after = P.get(core);
      assert.equal(after.pouch.money, 200 - first.price, "the purse paid, exactly once");
      assert.ok(
        after.pouch.items.some((row) => row.t === "rod" && row.k === "crude"),
        "the rod is in the pouch",
      );
      // AUTO-EQUIP, SCOPED: the tool slot, and only the tool slot.
      assert.deepEqual(after.skills.equipped.fishing.tool, ["rod", "crude"], "…and in the verb's tool slot");
      assert.equal(
        after.skills.equipped.fishing.mod,
        undefined,
        "bait never auto-equips — the slot is the verb's own act",
      );
      // LINE AND TACKLE INCLUDED, at the slug the theme's own water yields.
      const tin = after.pouch.items.find((row) => row.t === "bait");
      assert.equal(tin.k, E.starterBait(w), "the starter stack is the theme's first bait variant");
      assert.equal(tin.q, E.STARTER_BAIT, "…a real stack of it");
      assert.equal(bought.bait, tin.k, "and the verb says what it threw in");
      // …WHICH IS THE POINT: fished bait MERGES with it rather than orphaning a
      // second row of a thing the player already has.
      P.grant(core, { t: "bait", k: E.starterBait(w) }, 3);
      assert.equal(after.pouch.items.filter((row) => row.t === "bait").length, 1, "one bait row, not two");
      assert.equal(after.pouch.items.find((row) => row.t === "bait").q, E.STARTER_BAIT + 3, "…and it grew");
      assert.equal(
        Object.keys(after.bought ?? {}).length,
        0,
        "and nothing was written to `bought` — that map is world-bound shop depletion, and 0.12 ships no stock",
      );

      const second = E.rodOffer(core);
      assert.equal(second.tier, "decent", "a crude owner is quoted the next rung up");
      assert.equal(E.buyRod(core).ok, true, "…and takes it");
      assert.deepEqual(P.get(core).skills.equipped.fishing.tool, ["rod", "decent"], "auto-equip takes the BEST rung");
      assert.equal(
        P.get(core).pouch.items.filter((row) => row.t === "rod").length,
        2,
        "…while the old rod stays in the bag: the ladder is a read, not a trade-in",
      );

      const done = E.rodOffer(core);
      assert.equal(done.reason, "top-of-ladder", "a decent owner is quoted nothing");
      assert.equal(done.price, null, "…and a null price is what makes the button VANISH rather than dim");
      assert.equal(E.buyRod(core).ok, false, "and the verb refuses to sell a third one");
    }

    // ── A HOSTILE ROD ROW CLAMPS, AND THE LADDER GOES ON WORKING ──────────────
    // A save carrying `{t:"rod", k:"legendary"}` — a newer build's rung, or a
    // hand-edited row — resolves to CRUDE at every read. The ladder therefore
    // quotes `decent`, which is benign and is exactly what resolve-at-read is
    // for. grant() would refuse to mint that row, so the save is staged directly.
    {
      const core = fresh("chat-rod-hostile");
      stand(core, keeperZone, keeper);
      P.award(core, { money: 200 });
      assert.equal(P.grant(core, { t: "rod", k: "legendary" }, 1), 0, "no mutator can mint that rung");
      P.get(core).pouch.items.push({ t: "rod", q: 1, k: "legendary" });
      assert.equal(E.rodTier(P.get(core)), 0, "the ladder reads it as crude");
      assert.equal(E.rodOffer(core).tier, "decent", "…so the keeper quotes the rung above crude");
      assert.equal(E.buyRod(core).ok, true, "and sells it");
      assert.deepEqual(
        P.get(core).skills.equipped.fishing.tool,
        ["rod", "decent"],
        "auto-equip skips the ungradable row and takes the real one",
      );
    }

    // ── THE STUFFED POUCH IS REFUSED BEFORE A COIN MOVES ──────────────────────
    // grant() cannot refuse after award() has charged, so the arity pre-check is
    // the whole of what makes buyRod's no-rollback shape sound. A crude purchase
    // is TWO new rows — the rod and the starter tin — unless the player somehow
    // already holds bait, in which case it is one.
    {
      const core = fresh("chat-rod-stuffed");
      stand(core, keeperZone, keeper);
      P.award(core, { money: 200 });
      const cap = P.CAPS.items;
      for (let i = 0; i < cap - 1; i++) P.grant(core, { t: "catch-common", k: `filler-${i}` }, 1);
      assert.equal(P.get(core).pouch.items.length, cap - 1, "one row of headroom, and a crude rod needs two");
      const stuffed = E.rodOffer(core);
      assert.equal(stuffed.available, false, "the offer refuses");
      assert.equal(stuffed.reason, "pouch-full", "…saying which cap bit");
      assert.equal(stuffed.price, E.price(w, E.rodPriceKey("crude")), "…while still quoting the price");
      const before = P.get(core).pouch.money;
      const refused = E.buyRod(core);
      assert.equal(refused.ok, false, "and the verb refuses with it");
      // ONE SHAPE ON EVERY RETURN. The refusal after `award()` says `bait: null`
      // and this one, refusing earlier for the same purchase, used to omit the
      // key entirely — two ways of saying "nothing came with it" from one verb,
      // and a caller reading `bait` gets `undefined` from one branch and `null`
      // from the other for no reason it could ever discover.
      assert.deepEqual(
        Object.keys(refused).sort(),
        ["bait", "ok", "price", "reason", "tier"],
        `a refused purchase carries the verb's whole shape (${Object.keys(refused).sort()})`,
      );
      assert.equal(refused.bait, null, "…with nothing thrown in, said in the same word the other refusal uses");
      assert.equal(P.get(core).pouch.money, before, "NOTHING was charged — no half-purchase to roll back");
      assert.equal(P.get(core).pouch.items.length, cap - 1, "…and no row was minted either");

      // THE OTHER ARITY: a player who already holds bait needs one row, not two.
      P.get(core).pouch.items.pop();
      P.grant(core, { t: "bait", k: E.starterBait(w) }, 2);
      assert.equal(P.get(core).pouch.items.length, cap - 1, "still one row of headroom");
      assert.equal(E.rodOffer(core).available, true, "…but the tin is already there, so the rod is the only new row");
      assert.equal(E.buyRod(core).ok, true, "and it fits");
      assert.equal(P.get(core).pouch.items.length, cap, "exactly at the cap, with the starter stack merged in");
    }

    // ── AUTO-EQUIP IS SCOPED TO TOOLS, AT THIS CALL SITE ──────────────────────
    // equip() validates by item TYPE and not by SLOT: it refuses a graded row
    // whose `k` is off the ladder and is otherwise perfectly willing to put bait
    // in a `tool` slot. So the scoping is the caller's job, and this is the
    // caller. Pinned from both ends — the mutator's leniency is real, and the
    // helper refuses anyway.
    {
      const core = fresh("chat-autoequip-scope");
      P.award(core, { money: 200 });
      assert.equal(
        P.equip(core, "digging", "tool", { t: "bait", k: "worms" }),
        true,
        "the mutator itself would take bait into a tool slot",
      );
      P.equip(core, "digging", "tool", null);
      P.grant(core, { t: "bait", k: "worms" }, 4);
      P.grant(core, { t: "catch-prize", k: "old-tench" }, 1);
      // AND THE ROW THAT MAKES THE GUARD LOAD-BEARING. An ungraded type's `k` is
      // free, so nothing stops a bait row whose slug happens to READ like a rung.
      // Without the type guard the pouch scan would find it, call it the best
      // "bait" in the bag and bind it into the verb's TOOL slot — a bait rod.
      assert.equal(P.grant(core, { t: "bait", k: "crude" }, 1), 1, "an ungraded row may carry a rung-shaped slug");
      assert.equal(
        E._autoEquipTool(core, "fishing", "bait"),
        false,
        "…and the helper still refuses a type QUALITY does not grade",
      );
      assert.equal(E._autoEquipTool(core, "fishing", "catch-prize"), false, "a catch never equips at all");
      assert.equal(P.get(core).skills.equipped.fishing, undefined, "neither left a verb bucket behind");
      P.grant(core, { t: "rod", k: "crude" }, 1);
      assert.equal(E._autoEquipTool(core, "fishing", "rod"), true, "a tool does");
      assert.deepEqual(P.get(core).skills.equipped.fishing, { tool: ["rod", "crude"] }, "…in the tool slot, alone");
    }

    // ── …AND THE ROW FILTER INSIDE THE SCAN, WHICH THE TYPE GUARD DOES NOT ────
    // The scan skips any row whose `k` is not a rung, and that is a SECOND guard
    // doing a second job. A hostile `{t:"rod", k:"legendary"}` resolves to tier 0
    // — the same rung a crude rod resolves to — so a scan without the filter
    // finds it first, keeps it (nothing later ranks strictly ABOVE tier 0), and
    // hands equip() a `k` the mutator refuses: the verb ends up with no rod bound
    // at all while a perfectly good crude one sits in the bag beside it. The
    // ladder case further up cannot see this, because the rod it buys there is
    // DECENT and outranks the clamped row on the way past.
    {
      const core = fresh("chat-autoequip-hostile");
      P.get(core).pouch.items.push({ t: "rod", q: 1, k: "legendary" }); // FIRST in scan order
      P.grant(core, { t: "rod", k: "crude" }, 1);
      assert.equal(P.equip(core, "fishing", "tool", { t: "rod", k: "legendary" }), false, "equip() refuses that rung");
      assert.equal(E._autoEquipTool(core, "fishing", "rod"), true, "…so the scan has to have skipped it");
      assert.deepEqual(
        P.get(core).skills.equipped.fishing.tool,
        ["rod", "crude"],
        "…and bound the real rod behind it, rather than nothing at all",
      );
    }
  } finally {
    loadedPF.save.reset(); // the mutators self-dirty, and a dirty block arms a timer
  }
}

// ═══ THE FISHING VERB (0.12 slice 3's headline) ═════════════════════════════
// A cast is one window of clock, spent atomically: advance, roll, grant, award,
// accumulate. What the cases below pin is the part a playtest cannot see — that
// the roll is a function of RESOLVED state and nothing else, that bait is read
// before it is spent, that a session crossing midnight files each day under its
// own day, and that a session which caught nothing still costs the hours it
// spent.
{
  const E = loadedPF.economy;
  const P = loadedPF.player;
  const W = E.TUNING.castMinutes;

  /** Put the player at the bank of a registry row: a standable tile with a water
   *  tile of that row's rect next to it. The two-sided nearFeature test is
   *  30-sim's and pinned there; this only has to land on a tile that satisfies it. */
  const standAt = (sim, zoneId, row) => {
    const z = sim.world.zones[zoneId];
    for (let y = row.rect.y - 1; y <= row.rect.y + row.rect.h; y++) {
      for (let x = row.rect.x - 1; x <= row.rect.x + row.rect.w; x++) {
        if (x < 0 || y < 0 || x >= z.w || y >= z.h) continue;
        if (z.ground[y * z.w + x] === "water" || z.solid[y * z.w + x]) continue;
        sim.teleport(zoneId, x, y);
        sim.step(0, {});
        if (sim.nearFeature?.id === row.id) return true;
      }
    }
    return false;
  };

  /** A player standing at the legacy pond with whatever kit the case asks for.
   *  The legacy world because it is the smallest one that carries a registry row,
   *  a keeper and a fixed layout — nothing here is about the compiler. */
  let chats = 0;
  const angler = ({ clockMin = 9 * 60, day = 3, level = 1, tier = "crude", bait = 0, seed = 7, xp = 0 } = {}) => {
    const w = world.build(seed, "cozy-village", null);
    const sim = new loadedPF.Sim(w);
    sim.clockMin = clockMin;
    sim.day = day;
    sim.resolveSchedules();
    let dirty = 0;
    const core = {
      chatId: `chat-fish-${++chats}`,
      sim,
      hud: { toast() {}, refreshChips() {} },
      markDirty() {
        dirty++;
      },
    };
    assert.ok(standAt(sim, "village", w.zones.village.features[0]), "the fixture stands at the pond");
    if (tier) {
      P.grant(core, { t: "rod", k: tier }, 1);
      P.equip(core, "fishing", "tool", { t: "rod", k: tier });
    }
    if (level > 1) P.award(core, { xp: 5 * level * (level - 1), verb: "fishing" });
    if (xp) P.award(core, { xp, verb: "fishing" });
    if (bait) P.grant(core, { t: "bait", k: "worms" }, bait);
    return { w, sim, core, dirty: () => dirty };
  };
  const yieldList = (out) => out.caught.map((row) => `${row.t}:${row.k}`);
  const yields = (out) => yieldList(out).join("|");
  /** Total xp the block holds, from the ladder it climbed: Σ 10l for l < level, plus the remainder. */
  const totalXp = (row) => (row ? 5 * row.l * (row.l - 1) + row.x : 0);

  try {
    // ── DETERMINISM: SAME STATE, SAME FISH ────────────────────────────────────
    // The whole anti-save-scum property. A failed window is a fixed point escaped
    // only by spending different time — reload it, replay it, and it is the same
    // window with the same answer.
    {
      const a = angler({ level: 6 });
      const b = angler({ level: 6 });
      const first = E.fish(a.core, "dusk");
      const second = E.fish(b.core, "dusk");
      assert.ok(first.caught.length, `the session caught something to compare (${first.caught.length})`);
      assert.equal(yields(second), yields(first), "two clients, one state — the same fish in the same order");
      assert.equal(second.windows, first.windows, "…over the same number of windows");
      // …AND THE STATE IS REALLY AN INPUT: move one resolved number and the
      // stream re-keys.
      assert.notEqual(
        yields(E.fish(angler({ level: 6, day: 4 }).core, "dusk")),
        yields(first),
        "a different day is a different stream",
      );
      assert.notEqual(
        yields(E.fish(angler({ level: 6, seed: 909 }).core, "dusk")),
        yields(first),
        "…and so is a different world",
      );
      assert.notEqual(yields(E.fish(angler({ level: 9 }).core, "dusk")), yields(first), "…and a level climbed since");

      // THE WINDOW IS THE UNIT, and not the minute. `castWindow` is
      // floor(clockMin / W), so a cast at nine and a cast at seven minutes past
      // fall in the same window and ARE the same cast — which is the property
      // that makes a reload land on the answer it landed on before.
      const onTheHour = E.fish(angler({ level: 6, clockMin: 9 * 60 }).core, null);
      const sevenPast = E.fish(angler({ level: 6, clockMin: 9 * 60 + 7 }).core, null);
      assert.equal(yields(sevenPast), yields(onTheHour), "a minute inside a window is that window");

      // AND TWO SESSIONS LINE UP WINDOW FOR WINDOW: starting one window later
      // gives exactly the same stream minus that window's yield, because every
      // window seeds itself and none of them carries state into the next.
      let live = null;
      for (let minute = 0; minute < 17 * 60 && !live; minute += W) {
        const out = E.fish(angler({ level: 6, clockMin: minute }).core, null);
        if (out.caught.length) live = minute;
      }
      assert.ok(live !== null, "some window before dusk yields something");
      const whole = yieldList(E.fish(angler({ level: 6, clockMin: live }).core, "dusk"));
      const tail = yieldList(E.fish(angler({ level: 6, clockMin: live + W }).core, "dusk"));
      assert.ok(whole.length > tail.length, `the skipped window really did yield (${whole.length} vs ${tail.length})`);
      assert.deepEqual(
        whole.slice(whole.length - tail.length),
        tail,
        "…and the rest of the session is untouched by it",
      );
    }

    // ── A HOSTILE ROD RESOLVES, AND BOTH CLIENTS PULL THE SAME FISH ───────────
    // The seam the resolvers exist for. A save carrying `{t:"rod", k:"legendary"}`
    // — a newer build's rung, or a hand-edited row — reads as CRUDE at the hash,
    // so a client that has never heard of "legendary" rolls exactly the same
    // window as one that has.
    {
      const hostile = angler({ level: 6, tier: null });
      const block = P.get(hostile.core);
      block.pouch.items.push({ t: "rod", q: 1, k: "legendary" });
      block.skills.equipped.fishing = { tool: ["rod", "legendary"] };
      const crude = angler({ level: 6, tier: "crude" });
      assert.equal(
        yields(E.fish(hostile.core, "dusk")),
        yields(E.fish(crude.core, "dusk")),
        "a rung nobody can name is crude at the hash, not a different stream",
      );
      // …and the tier is a real input, so a REAL upgrade does move it.
      assert.notEqual(
        yields(E.fish(angler({ level: 6, tier: "decent" }).core, "dusk")),
        yields(E.fish(angler({ level: 6, tier: "crude" }).core, "dusk")),
        "a decent rod fishes a different stream from a crude one",
      );
    }

    // ── BAIT IS READ BEFORE IT IS SPENT ──────────────────────────────────────
    // The flip point, pinned exactly rather than statistically. PRESENCE, not
    // count: one bait and two bait roll the first window identically. And the
    // window a bait is SPENT on rolls baited — the slot-clear that follows the
    // last one lands on the window after, which then re-keys at tier 0 and reads
    // exactly like a session that never had any.
    // A TWO-WINDOW SESSION, so the flip lands inside one call: 06:30 is exactly
    // two casts short of morning, and the bait selection happens once at the
    // start of a session rather than once per window.
    {
      const fixture = { clockMin: 6 * 60 + 30, day: 3, level: 6, seed: 313 };
      const first = (bait) => yieldList(E.fish(angler({ ...fixture, bait }).core, null));
      const session = (bait) => E.fish(angler({ ...fixture, bait }).core, "day");
      const second = (bait) => yieldList(session(bait)).slice(first(bait).length);
      assert.equal(session(0).windows, 2, "the fixture really is two windows long");

      assert.deepEqual(first(1), first(2), "one bait and two bait roll the same first window — PRESENCE, not count");
      assert.notDeepEqual(first(1), first(0), "…and a baited window is not a baitless one: the tier is a hash input");
      assert.deepEqual(
        second(1),
        second(0),
        "the window AFTER the last bait re-keys at tier 0 — identical to never having had any",
      );
      assert.notDeepEqual(second(2), second(0), "…while a stack with one left still rolls the window it is spent on");
      // Non-vacuous on every arm: each of those windows actually yielded.
      for (const [what, got] of [
        ["baitless first", first(0)],
        ["baited first", first(1)],
        ["baitless second", second(0)],
        ["baited second", second(2)],
      ])
        assert.equal(
          got.length,
          1,
          `${what} window yielded, so the comparison is about the fish and not about silence`,
        );

      // THE RECONCILIATION the slot-clear is: the stack is spent and the slot is
      // not left pointing at a row that is gone. And it is NOT re-armed mid
      // session even when the session fishes up more bait — the selection is a
      // per-session act, so what it found is the next session's to spend.
      const single = angler({ ...fixture, bait: 1 }).core;
      const run = E.fish(single, "day");
      const spent = P.get(single);
      assert.equal(spent.skills.equipped.fishing.mod, undefined, "the spent slot is cleared, not left dangling");
      assert.ok(
        run.caught.some((row) => row.t === E.BAIT_TYPE),
        "this session fished more bait up — which is the point: fishing is bait's own finder",
      );
      assert.equal(
        spent.pouch.items.find((row) => row.t === E.BAIT_TYPE).q,
        1,
        "…one spent and one found, and the found one waits for the next session rather than re-arming this one",
      );
      // A SLOT POINTING AT A STACK THAT IS GONE is repaired by the verb, because
      // the verb is the only thing that ever fills it.
      const stale = angler({ level: 6, bait: 3 });
      P.get(stale.core).skills.equipped.fishing = { tool: ["rod", "crude"], mod: ["bait", "chum"] };
      E.fish(stale.core, null);
      assert.deepEqual(
        P.get(stale.core).skills.equipped.fishing.mod,
        ["bait", "worms"],
        "a slot pointing at a stack the pouch does not hold is re-pointed at one it does",
      );
    }

    // ── A SESSION THAT CROSSES MIDNIGHT FILES EACH DAY UNDER ITS OWN DAY ──────
    // The maintainer's ruled scenario made literal: the 00:30 sleeper flushes
    // LAST NIGHT's catch. That only works if the pre-midnight half of the session
    // was filed under the day it happened — the CAST and the FISH BOTH, which is
    // the half a "one line per day" count cannot see. The crossing window belongs
    // whole to the day its cast began in, and its day is filed once that window
    // has fully resolved rather than half-way through it.
    {
      // A fixture whose CROSSING window yields, so both lines have contents worth
      // reading. WHAT it yields is asked of a single cast over the same state —
      // the same window, seeded identically — rather than written down here.
      const solo = angler({ clockMin: 23 * 60 + 45, day: 5, level: 4 });
      const crossing = E.fish(solo.core, null);
      assert.equal(crossing.caught.length, 1, "the fixture's crossing window is one that catches");
      const fish = E.describe(solo.w, crossing.caught[0]);

      const night = angler({ clockMin: 23 * 60 + 45, day: 5, level: 4 });
      const out = E.fish(night.core, "dawn");
      assert.equal(night.sim.day, 6, "the session ran into the next day");
      assert.ok(night.sim.clockMin < 24 * 60, "…with the clock inside it");
      assert.deepEqual(out.days, [5, 6], "and it filed one line per day it spanned, in order");
      const lines = P.get(night.core).ledger.lines;
      const dayLine = (day) => {
        const found = lines.filter((line) => line[0] === day);
        assert.equal(found.length, 1, `ONE batched line for day ${day}`);
        return found[0][1];
      };
      const before = dayLine(5);
      const after = dayLine(6);
      assert.ok(/Fished/.test(before) && /Fished/.test(after), "both of them say where");
      // NON-VACUOUS: the wrap really did split a session that would otherwise be
      // one line — only one window fell on day 5, and the other twenty did not.
      assert.ok(/\b1 cast\b/.test(before), `day 5 got the single window it was owed (${before})`);
      assert.ok(/\b20 casts\b/.test(after), `…and day 6 got the rest (${after})`);
      // AND THE FISH WENT WITH THE CAST THAT SPENT THE HOURS. The crossing
      // window's catch is filed under the day the cast BEGAN, and it is not on
      // day 6's line — which is where a flush taken between that window's advance
      // and its roll puts it, leaving day 5 reporting an empty hour.
      assert.ok(before.includes(fish), `day 5's line names what the crossing window caught (${before})`);
      assert.ok(!after.includes(fish), `…and day 6's line does not claim it (${after})`);
      assert.ok(!/nothing biting/.test(after), `day 6 caught plenty of its own (${after})`);
    }

    // ── …AND A SINGLE CAST THAT CROSSES MIDNIGHT KEEPS ITS CATCH ──────────────
    // The sharpest shape of the same ordering, because it is the one where a
    // mis-placed flush loses the line outright rather than mis-filing it: one
    // window, and the wrap it crosses is the last thing the session does. The
    // pouch and the xp were never in doubt — what the ledger said was "1 cast,
    // nothing biting" about a cast that landed a fish, which is a record that
    // actively lies about the hour the player spent.
    {
      const at = angler({ clockMin: 23 * 60 + 45, day: 4, level: 1 });
      const out = E.fish(at.core, null);
      assert.equal(out.windows, 1, "one window");
      assert.equal(at.sim.day, 5, "…which crossed midnight");
      assert.equal(out.caught.length, 1, "…and caught something");
      const fish = E.describe(at.w, out.caught[0]);
      assert.deepEqual(out.days, [4], "the line is filed under the day the cast BEGAN, not the one it ended in");
      const lines = P.get(at.core).ledger.lines;
      assert.equal(lines.length, 1, "one line, and no orphan on the far side of midnight");
      assert.equal(lines[0][0], 4, "…on day 4");
      assert.ok(lines[0][1].includes(fish), `and it RECORDS the catch (${lines[0][1]})`);
      assert.ok(!/nothing biting/.test(lines[0][1]), "…rather than reporting an empty hour to the wrap-up");
    }

    // ── THE DAY-D LINE PASSES log()'s GATE, AND THE GATE IS REAL ──────────────
    // log() refuses a day the flush already covers. Mid-session `flushedDay` is
    // at most D−1 — telling day D would need a completed sleep after D's
    // midnight, which cannot have happened while the player is still at the
    // water — so the wrap's day-D line always lands. Both halves pinned: at D−1
    // it lands, and at D it would not, which is what makes the proof matter.
    {
      const safe = angler({ clockMin: 23 * 60 + 45, day: 5, level: 6 });
      P.get(safe.core).flushedDay = 4;
      assert.deepEqual(
        E.fish(safe.core, "dawn").days,
        [5, 6],
        "flushedDay D−1 is the worst a session can meet, and it passes",
      );

      const gated = angler({ clockMin: 23 * 60 + 45, day: 5, level: 6 });
      P.get(gated.core).flushedDay = 5;
      assert.deepEqual(
        E.fish(gated.core, "dawn").days,
        [6],
        "…and a day the gate covers is refused, so the gate is not decorative",
      );
    }

    // ── A CAST THAT CAUGHT NOTHING STILL COSTS THE HOURS ──────────────────────
    // The Wait precedent (70-hud): a clock mover that does not flag the save
    // loses its time on reload. Staged at its sharpest — the ledger line is
    // refused by the gate as well, so NO mutator runs at all and the verb's own
    // markDirty is the only thing standing between the player and losing it.
    {
      let barren = null;
      for (let minute = 0; minute < 24 * 60 && !barren; minute += W) {
        const at = angler({ clockMin: minute, day: 3, level: 1 });
        P.get(at.core).flushedDay = 3; // the line will be refused too
        const before = at.sim.clockMin;
        const out = E.fish(at.core, null);
        if (out.caught.length) continue;
        barren = { at, out, before };
      }
      assert.ok(barren, "a window somewhere in the day catches nothing — which is most of them at level 1");
      assert.equal(barren.at.sim.clockMin, barren.before + W, "the window was spent");
      assert.deepEqual(barren.out.days, [], "no ledger line survived the gate");
      assert.deepEqual(
        P.get(barren.at.core).pouch.items.filter((row) => row.t !== "rod"),
        [],
        "no row was minted",
      );
      assert.ok(barren.at.dirty() >= 1, "and the save was flagged anyway — refusals-after-advance included");
    }

    // ── XP GOES THROUGH ONE TABLE, KEYED ON `role ?? bait` ────────────────────
    // A bait-first session must mint a skill row: a player who has plainly been
    // fishing and whose sheet shows no fishing skill is the failure this closes.
    {
      const at = angler({ level: 1 });
      const out = E.fish(at.core, "dusk");
      const owed = out.caught.reduce((sum, row) => sum + E.TUNING.catchXp[row.t], 0);
      assert.ok(owed > 0, `the session earned something (${owed})`);
      assert.equal(totalXp(P.get(at.core).skills.verbs.fishing), owed, "the block holds exactly what the table owed");
      assert.ok(
        out.caught.some((row) => row.t === E.BAIT_TYPE),
        "…and bait was part of it, paying through the same table",
      );
      // THE LEVEL-UP READ: award() carries no leveled flag, so the verb reads the
      // PRIOR level itself. Staged one xp under the first threshold.
      const edge = angler({ level: 1, xp: 9 });
      assert.equal(P.get(edge.core).skills.verbs.fishing.x, 9, "one xp under leaving level 1");
      const climbed = E.fish(edge.core, "dusk");
      assert.equal(
        climbed.leveled,
        P.get(edge.core).skills.verbs.fishing.l,
        "the session reports the level it reached",
      );
      assert.ok(climbed.leveled > 1, "…which is above where it started");
      const flat = E.fish(angler({ level: 1 }).core, null);
      assert.equal(flat.leveled, 0, "and a session that crossed nothing reports nothing");
    }

    // ── A MID-LOOP GRANT REFUSAL SKIPS THE GRANT AND THE AWARD, AND GOES ON ───
    // grant() refuses only a NEW (t,k) row at the cap; merges never refuse. So a
    // session can meet the cap on a variant it has not caught before, and what
    // must NOT happen is xp for a fish that never entered the bag. Staged one row
    // short of the cap at level 1, where the pond opens exactly two variants: the
    // first to land takes the last row and the other can never be recorded.
    {
      const at = angler({ level: 1 });
      const cap = P.CAPS.items;
      const held = P.get(at.core).pouch.items.length;
      for (let i = 0; i < cap - held - 1; i++) P.grant(at.core, { t: "catch-common", k: `filler-${i}` }, 1);
      assert.equal(P.get(at.core).pouch.items.length, cap - 1, "one row of headroom");
      const out = E.fish(at.core, "dawn");
      assert.equal(out.ok, true, "the session runs to its target rather than stopping at the cap");
      assert.ok(out.windows > 40, `…all ${out.windows} windows of it`);
      const landed = new Set(out.caught.map((row) => `${row.t}:${row.k}`));
      assert.equal(landed.size, 1, `exactly one variant could be recorded (${[...landed]})`);
      assert.equal(P.get(at.core).pouch.items.length, cap, "the pouch is at the cap and stayed there");
      // THE HALF THAT MATTERS: no xp was paid for a fish the pouch refused.
      const owed = out.caught.reduce((sum, row) => sum + E.TUNING.catchXp[row.t], 0);
      assert.equal(
        totalXp(P.get(at.core).skills.verbs.fishing),
        owed,
        "the award was skipped with the grant, not after it",
      );
      // …and the ledger line names only what was actually landed.
      const line = P.get(at.core).ledger.lines.find((row) => row[0] === P.get(at.core).ledger.lines[0][0])[1];
      assert.ok(line.includes("Fished"), "a line was still written for the hours spent");
    }

    // ── "FISH UNTIL X" IS WHOLE WINDOWS TOWARD A DAYPART ──────────────────────
    {
      const at = angler({ clockMin: 9 * 60, day: 2, level: 4 });
      const out = E.fish(at.core, "dusk");
      assert.equal(out.windows, (18 * 60 - 9 * 60) / W, "nine hours of dusk-ward casting is thirty-six windows");
      assert.equal(at.sim.clockMin, 18 * 60, "landing exactly on the boundary when the clock divides");
      assert.equal(at.sim.day, 2, "…without touching the day");
      // FROM INSIDE THE DAYPART IT IS ASKED FOR, "until dusk" means the NEXT one —
      // the same reading waitUntil gives the same table.
      const inside = angler({ clockMin: 19 * 60, day: 2, level: 4 });
      E.fish(inside.core, "dusk");
      assert.equal(inside.sim.day, 3, "asking for dusk from inside dusk is asking for a day of it");
      // ONE CAST is one window, and the menu's other entry.
      const single = angler({ clockMin: 9 * 60, level: 4 });
      assert.equal(E.fish(single.core, null).windows, 1, "a single cast is one window");
      assert.equal(single.sim.clockMin, 9 * 60 + W, "…and W minutes of clock");
    }

    // ── THE REFUSALS, EACH DISTINCT, AND NONE OF THEM SPENDS A MINUTE ─────────
    {
      const at = angler({ level: 4 });
      const clock = at.sim.clockMin;
      const refuse = (what) => {
        const out = E.fish(at.core, null);
        assert.equal(out.ok, false, `${what}: refused`);
        assert.equal(at.sim.clockMin, clock, `${what}: and the clock did not move for it`);
        return out;
      };

      at.sim.mode = "dialogue";
      assert.equal(refuse("mid-conversation").reason, "wrong-mode", "walk only, like every other clock mover");
      at.sim.mode = "walk";

      at.sim.teleport("village", 21, 17); // the spawn, nowhere near water
      at.sim.step(0, {});
      assert.equal(refuse("dry land").reason, "not-near-water", "no spot, no session");
      assert.ok(standAt(at.sim, "village", at.w.zones.village.features[0]), "…back to the bank");

      loadedPF.save.gate = { chatId: at.core.chatId, state: "generating" };
      assert.equal(refuse("under the gate").reason, "gate-held", "a world nobody has entered has no water in it yet");
      loadedPF.save.gate = null;

      assert.equal(E.fish(at.core, "elevenses").reason, "unknown-target", "a daypart the clock does not have");
      assert.equal(at.sim.clockMin, clock, "…and that costs nothing either");

      // POUCH-FULL, which is the cap refusing the session rather than a window.
      const held = P.get(at.core).pouch.items.length;
      for (let i = 0; i < P.CAPS.items - held; i++) P.grant(at.core, { t: "catch-common", k: `stuff-${i}` }, 1);
      assert.equal(
        refuse("a full bag").reason,
        "pouch-full",
        "at the row cap only merges could land, so the session is refused",
      );
    }

    // ── A TARGET THE DAYPART TABLE ONLY LOOKS LIKE IT HAS ────────────────────
    // "elevenses" above is the easy half. The window count is looked up out of
    // PF.DAYPART_STARTS by whatever string the caller handed in, and a bare index
    // read reaches Object.prototype: `constructor` comes back a FUNCTION, sails
    // through the `!== undefined` test, and makes a window count of NaN. The loop
    // then runs zero times and the verb returns ok with `windows: 0` — so the HUD
    // toasts "Nothing biting" for a cast that never happened, which is a refusal
    // wearing a result's clothes and the one shape of this bug a player could
    // never report. The own-property test is what flattens all of it back into
    // the same "unknown-target" a typo gets.
    {
      const at = angler({ level: 4 });
      const clock = at.sim.clockMin;
      const day = at.sim.day;
      for (const target of ["constructor", "toString", "valueOf", "hasOwnProperty", "__proto__"]) {
        const out = E.fish(at.core, target);
        assert.equal(out.ok, false, `${target}: refused outright, not answered with an empty session`);
        assert.equal(out.reason, "unknown-target", `${target}: …in the word a mistyped daypart gets`);
        assert.equal(out.windows, 0, `${target}: …claiming no window`);
        assert.deepEqual(out.caught, [], `${target}: …and nothing out of the water`);
        assert.equal(at.sim.clockMin, clock, `${target}: …and not one minute of clock`);
        assert.equal(at.sim.day, day, `${target}: …nor a day of it`);
      }
    }

    // ── NO ROD: THE REFUSAL THAT POINTS AT A VENDOR ──────────────────────────
    // M8's amendment made this reachable on purpose. The button stays visible for
    // a rodless player standing at water, and pressing it says who sells one —
    // which is what turns an invisible mechanic into a discoverable one.
    {
      const bare = angler({ tier: null });
      const offer = E.fishOffer(bare.core);
      assert.equal(offer.available, false, "no rod, no session");
      assert.equal(offer.reason, "no-rod", "…said in its own words");
      assert.ok(offer.spot, "but the offer still names the spot, which is what keeps the button on screen");
      assert.ok(/innkeeper/.test(offer.hint), `and the hint names the keeper's compiled role (${offer.hint})`);
      const out = E.fish(bare.core, "dusk");
      assert.equal(out.reason, "no-rod", "the verb refuses with the same reason");
      assert.equal(out.hint, offer.hint, "…and carries the hint the button would show");
      assert.equal(bare.sim.clockMin, 9 * 60, "no hours were spent looking for a rod nobody has");

      // THEMED, and interpolated rather than hardcoded: a colony has no
      // innkeeper, and only the brief knows what it does have.
      const colony = new loadedPF.Sim(world.build(4242, "sci-fi-colony", brief.defaults("sci-fi-colony", 4242)));
      const colonyCore = { chatId: "chat-fish-hint", sim: colony, hud: { toast() {}, refreshChips() {} } };
      const hint = E.rodHint(colonyCore);
      assert.ok(/rig/.test(hint), `the colony's own words for the thing (${hint})`);
      assert.ok(!/innkeeper/.test(hint), "…and not a valley's word for the person");
      assert.ok(
        /keeper|quartermaster|steward|lead|marshal|scout/.test(hint),
        `naming whoever the brief made (${hint})`,
      );
      assert.notEqual(hint, E.rodHint(bare.core), "the two themes do not say the same sentence");

      // THE LEVEL-UP TOAST, the other line a colony reads out of this verb — and
      // the one that carried the raw English word instead of the theme's. The
      // sheet already renders the skill through `verbSkin`, so a colony that
      // levels "Fishing" on the toast and "Angling" on the panel is two names for
      // one number. Driven off the prototype over a stubbed session because the
      // sentence is what is under test and not the roll that earned it: a real
      // level-up here would need a colony pond, a rod and the xp to tip it, none
      // of which this line reads.
      const toasts = [];
      const surface = { core: colonyCore, toast: (t) => toasts.push(t), refreshChips() {} };
      const realFish = E.fish;
      try {
        E.fish = () => ({ ok: true, reason: null, hint: "", windows: 1, caught: [], leveled: 4, days: [] });
        loadedPF.Hud.prototype.fish.call(surface, "dusk");
      } finally {
        E.fish = realFish;
      }
      assert.equal(toasts.length, 1, "a level-up toasts once");
      assert.ok(/^Angling is level 4 now/.test(toasts[0]), `…in the colony's word for the verb (${toasts[0]})`);
      assert.ok(!/Fishing/.test(toasts[0]), "…and never the valley's");
    }

    // ── THE SEVENTH VALUE: NO PLAYER BLOCK ON THE SIM AT ALL ─────────────────
    // Not player-facing and not reachable in play — Sim's constructor
    // default-initialises the block and every restore path overwrites it — but it
    // is a value the offer really can return, so it belongs in the verb's
    // documented list beside `unknown-target` rather than sitting under it as an
    // undocumented seventh. Folded into that same caller-class bracket: both are
    // answered by the HUD's GENERIC sentence, because a control that spoke its
    // own copy about a lifecycle condition would be writing player-facing words
    // about a state no player can be in.
    {
      const at = angler({ level: 4 });
      at.sim.player = null;
      const offer = E.fishOffer(at.core);
      assert.equal(offer.available, false, "no block, no session");
      assert.equal(offer.reason, "no-player", "…in its own word, not folded into a refusal about the player");
      assert.equal(offer.spot, null, "…and naming no spot, which is what keeps the button off the screen for it");
      const out = E.fish(at.core, null);
      assert.equal(out.reason, "no-player", "the verb refuses with the same value");
      assert.equal(out.hint, "", "…carrying no hint of its own");
      assert.equal(at.sim.clockMin, 9 * 60, "…before a minute is spent");
      // AND WHAT IT REACHES THE PLAYER AS. Both callers toast
      // `hint || fishRefusal(reason)`, so the generic line this falls to has to be
      // a real sentence or a pressed button does nothing at all. Read off the
      // prototype because fishRefusal touches no instance state and the DOM shim
      // this file builds a real Hud over is declared further down.
      const line = (reason) => loadedPF.Hud.prototype.fishRefusal(reason);
      assert.ok(line("no-player").length > 0, "the generic line is a line");
      assert.equal(line("no-player"), line("unknown-target"), "…and it is the one the other caller-class value gets");
      assert.notEqual(line("no-player"), line("not-near-water"), "…while a player-facing refusal keeps its own words");
    }
  } finally {
    loadedPF.save.reset(); // the mutators self-dirty, and a dirty block arms a timer
  }
}

// ═══ THE WRAP-UP FLUSH (0.12 slice 4) ═══════════════════════════════════════
// Two fields and one burn. `intro.ledgerOwed` is durable and says which days a
// sleep has finished; `player.flushedDay` is durable and says which of them have
// been told; the tell itself is composed fresh every time and stored nowhere. The
// cases below are the state machine between them — the guard that refuses each
// way it can be asked to break the invariant, and the interleavings where the sim
// under a resolving send is not the sim that composed the turn.
{
  const P = loadedPF.player;
  let chats = 0;
  /** A player standing in a world with a staged wrap-up. `owed` is what a sleep
   *  left behind, `gate` is how much of it has already been told. */
  const staged = ({ day = 6, owed = 5, gate = 0, lines = [], notices = [] } = {}) => {
    const w = world.build(11, "cozy-village", null);
    const sim = new loadedPF.Sim(w);
    sim.day = day;
    sim.intro = { world: false, zones: {}, npcs: {}, ledgerOwed: owed };
    const core = {
      chatId: `chat-flush-${++chats}`,
      sim,
      host: { chatMeta: {} },
      hud: { toast() {}, refreshChips() {} },
      markDirty() {},
    };
    const p = P.get(core);
    p.flushedDay = gate;
    for (const [at, text] of lines) p.ledger.lines.push([at, text]);
    for (const [at, text] of notices) P.notice(p, text, at);
    assert.equal(sim.dirty, false, "the fixture is staged without dirtying anything");
    return { w, sim, core, player: p };
  };

  try {
    // ── THE GUARD REFUSES EACH INEQUALITY, SEPARATELY ─────────────────────────
    // Three tests, and each one is the only thing standing between a real
    // interleaving and a gate written where it does not belong. Pinned one at a
    // time, because a single "it refuses" case passes with two of them deleted.
    {
      // BACKWARDS. A tell composed against an older gate, resolving after a
      // newer one already rose: lowering the gate would re-tell days already told.
      const back = staged({ gate: 4 });
      assert.equal(P.flush(back.core, 3), false, "a throughDay BELOW the gate is refused");
      assert.equal(back.player.flushedDay, 4, "…and the gate does not move");

      // PAST WHAT ANY SLEEP MADE OWED. Days beyond the marker are days the player
      // has not finished living, or days a rewound sim never staged.
      const ahead = staged({ owed: 5, day: 9 });
      assert.equal(P.flush(ahead.core, 6), false, "a throughDay ABOVE ledgerOwed is refused");
      assert.equal(ahead.player.flushedDay, 0, "…and the gate does not move");

      // AND NEVER THE DAY UNDERWAY, whatever the marker says. `ledgerOwed` is
      // durable and `sim.day` is not, so a rewind can leave a marker standing over
      // a clock that has gone backwards — and telling the day being lived means
      // telling half of it and then never telling the rest.
      const today = staged({ owed: 7, day: 6 });
      assert.equal(P.flush(today.core, 6), false, "a throughDay AT the live day is refused, marker or no marker");
      assert.equal(P.flush(today.core, 5), true, "…while the day before it is exactly what the tell is for");
      assert.equal(today.player.flushedDay, 5, "and THAT one moves the gate");

      // …AND ALL THREE ARE READ THROUGH THE RESOLVER, which a raw read passes for
      // free on every ASCII-clean fixture above. `intro` is nested inside the
      // envelope and `simFromSaved` resolves it on the way in, so the belt only
      // matters on a sim built some other way (a rebuild from a hand-made row, a
      // newer build's field) — but a string is exactly where the two readings
      // diverge: `4 > "4"` is FALSE, so a raw read lets a marker that owes nothing
      // license a burn, while `resolvedDay("4")` is 0 and refuses it.
      const hostile = staged({ owed: "4", day: 6 });
      assert.equal(P.flush(hostile.core, 4), false, 'a ledgerOwed of "4" owes nothing, so it licenses nothing');
      assert.equal(hostile.player.flushedDay, 0, "…and the gate does not move");
    }

    // ── …AND WHAT IT DOES WHEN IT ACCEPTS ─────────────────────────────────────
    {
      const at = staged({ gate: 2, owed: 5, day: 6, notices: [[3, "Something was set aside."]] });
      // The third argument is the rows the COMPOSE captured, which for an all-untold
      // band is the band itself — what `_composeLedger` hands the sender (below).
      assert.equal(
        P.flush(at.core, 5, at.player.ledger.notices),
        true,
        "the ordinary case: gate < throughDay ≤ owed < day",
      );
      assert.equal(at.player.flushedDay, 5, "the gate rises to the day that was told");
      assert.deepEqual(at.player.ledger.notices[0], [3, "Something was set aside.", 1], "…and the band is marked told");
      assert.equal(at.sim.dirty, true, "…and the save is flagged, because the mutator does that for its callers");
      assert.equal(loadedPF.player.get(at.core).ledger.notices[0][2], 1, "the flag is on the live block, not a copy");

      // A SECOND BURN AT THE SAME DAY IS A NO-OP THAT STILL PASSES. Two senders
      // can compose the same wrap-up and both be accepted (§5), so the second
      // burn has to be harmless rather than refused — `max` is what makes it so.
      assert.equal(P.flush(at.core, 5, at.player.ledger.notices), true, "an equal throughDay is accepted");
      assert.equal(at.player.flushedDay, 5, "…and changes nothing");

      // THE FLOOR CASE: nothing owed, nothing told, and a notice waiting. The
      // band answers to its flag and not to a day, so a save that has never slept
      // still tells its notices — and the burn that marks them raises no gate.
      const bandOnly = staged({ owed: 0, gate: 0, day: 1, notices: [[1, "A task has no one to hand it back to."]] });
      assert.equal(
        P.flush(bandOnly.core, 0, bandOnly.player.ledger.notices),
        true,
        "throughDay 0 against owed 0 is a legal burn",
      );
      assert.equal(bandOnly.player.flushedDay, 0, "the gate stays where it was");
      assert.equal(bandOnly.player.ledger.notices[0][2], 1, "…and the notice is told");

      // …AND THE SAME FLOOR WITH A GATE THAT OUTLIVED ITS MARKER. The partial
      // restore is what produces it: the player block rehydrates OUTSIDE the
      // envelope's `v` gate (60-save §"the player block, rehydrated"), so a row
      // whose envelope this build cannot read — and equally a NEWER build's row
      // that moved `intro.ledgerOwed` out from under a `v` we still accept —
      // comes back carrying the gate the player earned and a marker that owes
      // nothing. `flushedDay > ledgerOwed` is the one shape the invariant does
      // not cover, because the burn is not the writer that made it.
      //
      // The band answers to its FLAG and not to a day, so this is still a tell:
      // a notice-only compose burns AT the gate, `max` moves it nowhere, and the
      // rows it carried are marked. Guarding that on the day numbers starved the
      // band FOREVER — nothing below `flushedDay` can raise `ledgerOwed` back to
      // it, so every later compose re-told the same notice.
      const carried = staged({ owed: 0, gate: 5, day: 6, notices: [[3, "The world was severed and came back."]] });
      assert.equal(
        P.flush(carried.core, 5, carried.player.ledger.notices),
        true,
        "a burn AT a gate that outlived its marker is still a burn",
      );
      assert.equal(carried.player.flushedDay, 5, "…and it moves the gate nowhere");
      assert.equal(carried.player.ledger.notices[0][2], 1, "…while the notice it carried is told");
      assert.equal(carried.sim._composeLedger(), null, "…so the next compose has nothing left to say");

      // …AND A BURN WITH NO ROWS TELLS NO ROWS. A tell that carried only days
      // marks only days: the band is not swept up by a turn that never mentioned
      // it, which is the property the rebuild cases below turn on.
      const daysOnly = staged({ gate: 2, owed: 5, day: 6, notices: [[3, "Nobody composed this one."]] });
      assert.equal(P.flush(daysOnly.core, 5, []), true, "a burn carrying no notice rows is still a burn");
      assert.equal(daysOnly.player.flushedDay, 5, "…and still moves the gate");
      assert.equal(daysOnly.player.ledger.notices[0][2], undefined, "…while the band it never told stays untold");
    }

    // ── A DAY THAT IS NOT A DAY IS NOT A BURN ─────────────────────────────────
    {
      const at = staged({ owed: 5, day: 6 });
      for (const junk of ["5", 4.5, -1, NaN, null, undefined]) {
        assert.equal(P.flush(at.core, junk), false, `a throughDay of ${JSON.stringify(junk)} is refused`);
      }
      assert.equal(at.player.flushedDay, 0, "and none of them moved the gate");
    }

    // ── THE FENCE AND THE GATE, which every mutator answers to ────────────────
    {
      const at = staged({ owed: 5, day: 6 });
      assert.equal(P.flush(at.core, 5, null, (loadedPF.save._gen ?? 0) + 1), false, "a stale generation is refused");
      assert.equal(at.player.flushedDay, 0, "…and writes nothing");
      loadedPF.save.gate = { chatId: at.core.chatId, state: "generating" };
      assert.equal(P.flush(at.core, 5), false, "and so is a chat whose world is still being written");
      loadedPF.save.gate = null;
      assert.equal(at.player.flushedDay, 0, "…still writing nothing");
      assert.equal(P.flush(at.core, 5), true, "with both lifted, the same call goes through");
    }

    // ── THE SAME-CHAT REBUILD, which is the seam the fence CANNOT see ─────────
    // `_gen` moves on a chat switch only. `_rebuild` replaces `core.sim` wholesale
    // without touching it — a rewind, a swipe, a checkpoint load — so a send that
    // composed before one and resolves after it passes the fence with a
    // `throughDay` belonging to a sim that no longer exists. The guard reads the
    // LIVE sim, so the rewound block refuses it and keeps its own gate.
    {
      const at = staged({ owed: 5, day: 6, notices: [[4, "Something was set aside."]] });
      // The row the rewind lands on: this chat, one sleep ago. It has no staged
      // day in it, because the sleep that staged one has been rewound away.
      const before = JSON.parse(JSON.stringify(loadedPF.save.snapshot(at.core)));
      before.intro = { world: false, zones: {}, npcs: {} };
      before.day = 6;
      const composed = 5; // what the sender captured, against the sim above
      loadedPF.save._rebuild(at.core, before);
      assert.notEqual(at.core.sim, at.sim, "the rebuild really did replace the sim under the send");
      assert.equal(at.core.sim.intro.ledgerOwed, 0, "…with one that owes nothing");
      assert.equal(
        P.flush(at.core, composed, at.player.ledger.notices),
        false,
        "so the burn is REFUSED, on the live sim's own numbers",
      );
      assert.equal(P.get(at.core).flushedDay, 0, "the rewound block keeps its gate");
      // AND ITS BAND IS ITS OWN. The rebuilt block carries the same SENTENCE —
      // it came off the same row — in a different row object, which is exactly
      // why the burn must not reach it: marking that copy told would swallow a
      // notice nobody has been given, on the strength of a tell composed against
      // a sim that no longer exists.
      const rebuilt = P.get(at.core).ledger.notices ?? [];
      assert.equal(rebuilt.length, 1, "the rebuilt block carries its own copy of the band");
      assert.notEqual(rebuilt[0], at.player.ledger.notices[0], "…a different row, rebuilt from the row's own bytes");
      assert.equal(rebuilt[0][2], undefined, "and the refused burn left it untold");
      // AND THE OLD BLOCK IS NOT WRITTEN INTO EITHER: the refusal happened before
      // anything moved, so the sim that composed keeps its untold band as well.
      assert.equal(at.player.ledger.notices[0][2], undefined, "the sim that composed keeps its band untold");
    }

    // ── THE REBUILD THE GUARD HAS NO REASON TO REFUSE ─────────────────────────
    // The case above is the LOUD rebuild — a rewind, which un-stages the marker
    // and is refused on the numbers. It is not the only rebuild there is. Three
    // of the five notice writers (the dangling-quest repair, the mint severance,
    // and a restore landing on a gate already where it was) leave `flushedDay`,
    // `ledgerOwed` and `sim.day` exactly as they found them, so a send resolving
    // over one of THOSE rebuilds meets a guard with nothing to object to. What it
    // also meets is a notice NOBODY COMPOSED: written after the tell went out and
    // owed to the next one.
    //
    // Which is the whole reason the burn marks the rows the COMPOSE captured
    // rather than whatever is in the live band when it lands. The band answers to
    // the told flag and to nothing else — no gate, no day — so a row marked told
    // that nobody was told is a sentence destroyed in silence.
    {
      loadedPF.quarantine.reset();
      const at = staged({
        gate: 2,
        owed: 5,
        day: 7,
        lines: [
          [3, "The third."],
          [4, "The fourth."],
        ],
      });
      // A quest whose giver is standing in this world and one whose giver is not.
      // Both, because EVERY giver dangling is a statement about the world rather
      // than about the quests, and the repair declines that one (case z).
      P.get(at.core).quests.active = [
        { id: "q-real", g: "village|Tam", verb: "gather", target: "herb", n: 1, have: 0, r: {}, day: 1 },
        { id: "q-ghost", g: "village|Nobody At All", verb: "gather", target: "herb", n: 1, have: 0, r: {}, day: 1 },
      ];
      at.sim.composePrefix(null);
      const pend = at.sim._pendingIntro;
      assert.deepEqual(
        pend.ledger.notices,
        [],
        "the turn went out with an empty band — days to tell, and nothing else",
      );
      assert.equal(pend.ledger.throughDay, 4, "…reaching day 4");

      // THE REBUILD, through the real machinery: the row this chat would have
      // saved, rebuilt under the send exactly as _applyRewind and _adoptNow do it.
      const row = JSON.parse(JSON.stringify(loadedPF.save.snapshot(at.core)));
      loadedPF.save._rebuild(at.core, row);
      const live = P.get(at.core);
      assert.notEqual(at.core.sim, at.sim, "the rebuild replaced the sim under the send");
      assert.deepEqual(
        [live.flushedDay, at.core.sim.intro.ledgerOwed, at.core.sim.day],
        [2, 5, 7],
        "…and left every number the guard reads exactly where it found them",
      );
      const fresh = (live.ledger.notices ?? []).filter(([, text]) => /no one left to hand it back/.test(text));
      assert.equal(fresh.length, 1, "the rebuild's own repair wrote a notice no compose has ever seen");
      assert.equal(fresh[0][2], undefined, "…untold, because it is younger than the tell still in flight");

      // AND THE BURN LANDS, because there is nothing here for the guard to catch.
      assert.equal(
        P.flush(at.core, pend.ledger.throughDay, pend.ledger.notices),
        true,
        "so the burn is ACCEPTED, on the live sim's numbers",
      );
      assert.equal(live.flushedDay, 4, "…raising the gate, which is what it was for");
      assert.equal(fresh[0][2], undefined, "but the fresh notice is STILL UNTOLD — the burn marks what was composed");
      const after = at.core.sim.composePrefix(null);
      assert.ok(/no one left to hand it back/.test(after), `…so the NEXT turn is the one that carries it (${after})`);
    }

    // ── THE ROW ONLY THE SECOND COMPOSE CARRIED ───────────────────────────────
    // No rebuild in this one, and the same rule decides it. Travel composes over
    // an empty band and awaits; a notice is written under it; Talk composes and
    // CARRIES that notice; then Travel's turn comes back accepted and burns. The
    // row Travel never told is not Travel's to mark — and if it marks it, a Talk
    // the host then refuses leaves a sentence that reached nobody flagged as
    // delivered, which nothing in the band can undo.
    {
      const at = staged({ gate: 1, owed: 4, day: 6, lines: [[3, "The day they both told."]] });
      at.sim.composePrefix(null);
      const pendTravel = at.sim._pendingIntro;
      assert.deepEqual(pendTravel.ledger.notices, [], "Travel composed over an empty band");

      P.notice(at.player, "A task you had taken on has no one left to hand it back to, so you have let it go.", 4);
      const talk = at.sim.composePrefix(null);
      const pendTalk = at.sim._pendingIntro;
      assert.ok(
        /no one left to hand it back/.test(talk),
        `…and Talk, composing after it, carries the notice (${talk})`,
      );
      assert.deepEqual(pendTalk.ledger.notices, [at.player.ledger.notices[0]], "…as the row itself");

      assert.equal(
        P.flush(at.core, pendTravel.ledger.throughDay, pendTravel.ledger.notices),
        true,
        "Travel's accepted turn burns",
      );
      assert.equal(at.player.flushedDay, 3, "…its own days");
      assert.equal(at.player.ledger.notices[0][2], undefined, "…and NOT the row only Talk composed");
      assert.equal(
        P.flush(at.core, pendTalk.ledger.throughDay, pendTalk.ledger.notices),
        true,
        "then Talk's turn burns",
      );
      assert.equal(at.player.ledger.notices[0][2], 1, "…and THAT is what tells the notice it carried");
    }

    // ── WHAT THE TELL SELECTS, AND WHERE IT SITS IN THE TURN ──────────────────
    {
      const at = staged({
        gate: 2,
        owed: 5,
        day: 7,
        lines: [
          [2, "Told already, on the day the gate covers."],
          [3, "Day 3: 12 things happened.", 12],
          [4, "Fished the millpond — 12 casts: carp x2."],
          [4, "Took a berth at The Amber Hearth for 12 coins."],
          [6, "Not owed yet — past the marker, and the player is still living it."],
        ],
        notices: [[3, "Some of what you had done here belonged to another world."]],
      });
      const prefix = at.sim.composePrefix(null);
      const part = prefix.slice(prefix.indexOf("[Wrap-up"));
      assert.ok(prefix.includes("[Wrap-up — "), "the tell rides the prefix as a part of its own");
      assert.ok(prefix.startsWith("[World:"), "…and the header still comes first");
      assert.ok(prefix.endsWith(part) && part.endsWith("]"), "the tell is LAST in the join — after the prose parts");

      // THE WINDOW IS `flushedDay < day ≤ ledgerOwed`, both ends live.
      assert.ok(!part.includes("Told already"), "a day at or below the gate has already been told");
      assert.ok(!part.includes("Not owed yet"), "…and a day past the marker is not this turn's to tell");
      assert.ok(part.includes("Day 3: 12 things happened."), "a STUB rides the tell — an elided day still happened");
      assert.ok(part.includes("Day 4: Fished the millpond"), "and the days between are told whole");
      assert.ok(part.includes("Took a berth"), "…every line of them, in the order they were logged");
      assert.ok(part.indexOf("Day 3") < part.indexOf("Day 4"), "oldest day first, so the story arrives in order");
      assert.ok(
        /Also, about the world itself rather than the days in it: Some of what you had done/.test(part),
        `and the untold band rides with ONE framing sentence (${part})`,
      );

      // COMPOSE IS PURE. Nothing is burned until the host says yes — a refused
      // send must lose neither the days nor the notices.
      assert.equal(at.player.flushedDay, 2, "compose moved no gate");
      assert.equal(at.player.ledger.notices[0][2], undefined, "…and told no notice");
      assert.equal(at.sim.dirty, false, "…and dirtied nothing");

      // WHAT IT HANDS THE SENDER: the day it reached, and the notice ROWS it
      // composed — the rows themselves, so the burn marks what was told.
      const pend = at.sim._pendingIntro;
      assert.equal(pend.ledger.throughDay, 4, "the pending carries the last day rendered whole");
      assert.deepEqual(pend.ledger.notices, [at.player.ledger.notices[0]], "…and the band rows it composed");

      // A RE-TELL IS NOT A REPLAY. Nothing stored the first throughDay, so a
      // second compose over unmoved fields simply selects the same days again.
      assert.equal(at.sim.composePrefix(null), prefix, "a recompose with nothing staged says the same thing");

      // …AND THE BURN CLOSES IT.
      assert.equal(P.flush(at.core, pend.ledger.throughDay, pend.ledger.notices), true, "the accepted turn burns");
      assert.equal(at.player.flushedDay, 4, "the gate rose to the day that was told");
      assert.equal(at.player.ledger.notices[0][2], 1, "the band it told is told");
      assert.equal(at.sim.composePrefix(null), at.sim.header(), "and the next turn has nothing left to say");
    }

    // ── M10: NOTHING ELSE IN A TURN KNOWS FISHING HAPPENED ────────────────────
    // The verb narrates nothing and takes no receipt turn. Its lines reach the GM
    // through the wrap-up or not at all, so a prefix composed before the sleep
    // that makes them owed carries no fishing word anywhere in it.
    {
      const quiet = staged({ owed: 0, day: 4, lines: [[3, "Fished the millpond — 12 casts: carp x2."]] });
      assert.equal(quiet.sim.composePrefix(null), quiet.sim.header(), "nothing owed, nothing said");
      quiet.sim.intro.ledgerOwed = 3; // what a sleep stages
      const after = quiet.sim.composePrefix(null);
      assert.ok(after.includes("Fished the millpond"), "…and after the sleep it is in the tell");
      assert.equal(
        after.indexOf("Fished"),
        after.indexOf("[Wrap-up") + after.slice(after.indexOf("[Wrap-up")).indexOf("Fished"),
        "…inside the wrap-up part, which is the only part that carries it",
      );
    }

    // ── TRUNCATION DROPS THE NEWEST DAYS, AND THE BURN FOLLOWS IT ─────────────
    // Whole days or none. The tell renders oldest-first until the next day would
    // put it over `ledgerTellChars`, then stops — and the burn advances only
    // through the last day rendered WHOLE, so `ledgerOwed` survives a partial
    // tell and the next accepted turn picks up exactly where this one stopped.
    {
      const budget = loadedPF.economy.TUNING.ledgerTellChars;
      const wide = "w".repeat(P.CAPS.ledgerChars);
      // Sized off the shipped budget rather than written down: enough lines that
      // TWO days fit and three cannot, so the drop is the budget's decision and
      // not the fixture's.
      const perDay = Math.floor(budget / 2 / P.CAPS.ledgerChars);
      const dayCost = perDay * P.CAPS.ledgerChars;
      assert.ok(2 * dayCost <= budget && 3 * dayCost > budget, `the fixture straddles the budget (${dayCost} each)`);
      const lines = [];
      for (const day of [3, 4, 5]) for (let i = 0; i < perDay; i++) lines.push([day, wide]);
      const at = staged({ gate: 2, owed: 5, day: 9, lines });
      const first = at.sim.composePrefix(null);
      assert.ok(first.includes("Day 3:"), "the oldest owed day is told");
      assert.ok(first.includes("Day 4:"), "…and the next one, because it still fits");
      assert.ok(!first.includes("Day 5:"), "…and the NEWEST day is what the budget drops");
      assert.equal(at.sim._pendingIntro.ledger.throughDay, 4, "so the burn covers only what was rendered whole");
      assert.equal(P.flush(at.core, 4), true, "…and it is a legal burn");
      assert.equal(at.player.flushedDay, 4, "the gate stops at the last whole day");
      assert.equal(
        P.get(at.core).ledger.lines.some(([day]) => day === 5),
        true,
        "day 5 is still in the buffer",
      );
      assert.equal(at.sim.intro.ledgerOwed, 5, "…and still owed: a partial tell does not spend the marker");
      const second = at.sim.composePrefix(null);
      assert.ok(second.includes("Day 5:") && !second.includes("Day 4:"), "the next turn continues from day 5");
      assert.equal(at.sim._pendingIntro.ledger.throughDay, 5, "…and would burn through it");
    }

    // ── A MAXIMUM-SHAPE DAY RENDERS WHOLE, which is what the floor buys ───────
    // `ledgerTellChars` is asserted at load against `ledgerPerDay × ledgerChars`
    // (59-economy), and this is the case that spends it: the biggest day the
    // caps allow — fifteen lines of two hundred graphemes — has to render, or the
    // burn advances through nothing and the flush stalls for the rest of the save.
    {
      const lines = [];
      for (let i = 0; i < P.CAPS.ledgerPerDay; i++) lines.push([3, "m".repeat(P.CAPS.ledgerChars)]);
      const at = staged({ gate: 2, owed: 3, day: 5, lines });
      const part = at.sim.composePrefix(null);
      assert.ok(part.includes("Day 3:"), "a maximum-shape day is told");
      assert.equal(
        (part.match(new RegExp("m".repeat(P.CAPS.ledgerChars), "g")) ?? []).length,
        P.CAPS.ledgerPerDay,
        "…every line of it, whole",
      );
      assert.equal(at.sim._pendingIntro.ledger.throughDay, 3, "and the burn covers it");

      // …AND A DAY NOTHING CAN FIT STILL RIDES. A day this build can write cannot
      // exceed the budget, but a hostile save can carry fifty lines on one, and
      // "tell nothing and advance nothing, forever" is the worse answer.
      const huge = [];
      for (let i = 0; i < 50; i++) huge.push([3, "h".repeat(P.CAPS.ledgerChars)]);
      const over = staged({ gate: 2, owed: 3, day: 5, lines: huge });
      assert.ok(over.sim.composePrefix(null).includes("Day 3:"), "an oversized day is told rather than stalling");
      assert.equal(over.sim._pendingIntro.ledger.throughDay, 3, "…and the gate can still move past it");
    }

    // ── …AND IT IS MEASURED IN GRAPHEMES, WHICH ASCII CANNOT SHOW ─────────────
    // Every ledger fixture above is ASCII, where a grapheme, a code point and a
    // UTF-16 unit are the same thing — so swapping `PF.player.graphemes(text)` for
    // `Array.from(text)` in the tell's budget survives every one of them. The caps
    // are stated in graphemes and the floor assertion multiplies two of them, so a
    // measure that disagrees makes the floor a promise about a different quantity
    // and truncates legal days for content the player is allowed to write: a zone
    // name with one family emoji in it is seven code points wide.
    //
    // The family cluster is the sharpest instrument for it — four astral code
    // points and three joiners, ONE grapheme, and no shorter way to be seven times
    // the size of what you look like.
    {
      const family = "\u{1F468}‍\u{1F469}‍\u{1F467}‍\u{1F466}";
      assert.equal(P.graphemes(family).length, 1, "one cluster");
      assert.equal(Array.from(family).length, 7, "…seven code points, which is the whole of the risk");

      // (a) THE DISCRIMINATING PAIR. A short day, then an astral day whose
      // GRAPHEME cost leaves the budget room to spare and whose code-point cost
      // is four times over it. Measured right, the tell reaches day 4; measured in
      // code points, day 4 is dropped and the burn stops a day short — the same
      // over-eager truncation an emoji in a zone name would cause on a real save.
      const budget = loadedPF.economy.TUNING.ledgerTellChars;
      const astral = family.repeat(P.CAPS.ledgerChars);
      const wideDay = 10;
      assert.ok(
        12 + wideDay * P.CAPS.ledgerChars <= budget && 12 + wideDay * P.CAPS.ledgerChars * 7 > budget,
        "the fixture fits in graphemes and does not fit in code points, which is the whole case",
      );
      const pair = staged({ gate: 2, owed: 4, day: 6, lines: [[3, "A quiet day."]] });
      for (let i = 0; i < wideDay; i++)
        assert.equal(P.log(pair.core, astral, 4), true, "a legal astral line is logged");
      const part = pair.sim.composePrefix(null);
      assert.ok(part.includes("Day 3:") && part.includes("Day 4:"), `both days are told (${part.length} chars)`);
      assert.equal(pair.sim._pendingIntro.ledger.throughDay, 4, "…so the burn reaches the astral day");

      // (b) THE MAX-SHAPE ASTRAL DAY, which is the floor assertion's own promise
      // spent on the widest content the caps permit: fifteen lines of two hundred
      // CLUSTERS is exactly `ledgerPerDay × ledgerChars`, and 21,000 code points.
      // Written through log(), so `clip` is measured here too — a code-point clip
      // would cut each line at 28 clusters and through the middle of the 29th.
      const max = staged({ gate: 2, owed: 3, day: 5 });
      for (let i = 0; i < P.CAPS.ledgerPerDay; i++) assert.equal(P.log(max.core, astral, 3), true, "…and kept whole");
      assert.equal(
        P.graphemes(max.player.ledger.lines[0][1]).length,
        P.CAPS.ledgerChars,
        "clip counts clusters: a line at the cap loses nothing",
      );
      const whole = max.sim.composePrefix(null);
      assert.ok(whole.includes("Day 3:"), "a maximum-shape astral day is told");
      assert.equal(
        whole.split(family).length - 1,
        P.CAPS.ledgerPerDay * P.CAPS.ledgerChars,
        "…every cluster of every line of it",
      );
      assert.equal(max.sim._pendingIntro.ledger.throughDay, 3, "and the burn covers it");
    }

    // ── THE COMPACTION RE-TELL: A TOLD DAY THAT BECAME A STUB ─────────────────
    // A lost burn (§5) leaves the tell in history and the gate where it was, so
    // the next compose says it again — and by then the buffer may have compacted
    // the very days it is re-telling. The re-tell renders the STUB, which is
    // bounded and content-preserving rather than a hole.
    {
      const at = staged({
        gate: 0,
        owed: 5,
        day: 6,
        lines: [
          [1, "The first day."],
          [2, "The second."],
          [3, "The third."],
          [4, "The fourth."],
          [5, "The fifth."],
        ],
      });
      const first = at.sim.composePrefix(null);
      assert.ok(first.includes("The first day.") && first.includes("The fifth."), "the tell covers days 1 to 5");
      // The send was accepted and the burn was lost — nothing is called here,
      // which IS the lost flush. Then the day moves on and the buffer compacts.
      assert.equal(P.log(at.core, "Something on day 6.", 6), true, "a later line compacts the buffer");
      const again = at.sim.composePrefix(null);
      assert.ok(!again.includes("The first day."), "day 1 is no longer a line");
      assert.ok(/Day 1: 1 thing happened\./.test(again), `…it is a stub, and the re-tell renders it (${again})`);
      assert.ok(again.includes("The fifth."), "…while the days still held in full are still told in full");
      assert.equal(at.sim._pendingIntro.ledger.throughDay, 5, "and the re-tell still reaches the same day");
    }

    // ── TWO SENDERS, ONE WRAP-UP: BOTH ACCEPTED, THE SECOND BURN A NO-OP ──────
    // Travel composes and awaits; Talk slips into the window and composes the
    // same tell; the host accepts both, so the GM hears it twice in one history
    // (§5, accepted). What must NOT happen is the second burn doing anything.
    {
      const at = staged({ gate: 1, owed: 4, day: 6, lines: [[3, "The day they both told."]] });
      const travel = at.sim.composePrefix(null);
      const pendTravel = at.sim._pendingIntro;
      const talk = at.sim.composePrefix(null);
      const pendTalk = at.sim._pendingIntro;
      assert.equal(talk, travel, "the second compose selects the same days over the same live fields");
      assert.notEqual(pendTalk, pendTravel, "…on its own pending object");
      assert.equal(pendTalk.ledger.throughDay, pendTravel.ledger.throughDay, "…reaching the same day");
      assert.equal(
        P.flush(at.core, pendTravel.ledger.throughDay, pendTravel.ledger.notices),
        true,
        "the first burn goes through",
      );
      assert.equal(at.player.flushedDay, 3, "…and moves the gate");
      assert.equal(
        P.flush(at.core, pendTalk.ledger.throughDay, pendTalk.ledger.notices),
        true,
        "the second is accepted rather than refused",
      );
      assert.equal(at.player.flushedDay, 3, "…and changes nothing, which is what `max` is for");
    }
  } finally {
    loadedPF.save.gate = null;
    loadedPF.save.reset(); // the mutators self-dirty, and a dirty block arms a timer
  }
}

// ═══ SLEEP, AND WHAT IT LEAVES BEHIND (0.12 slice 4) ════════════════════════
// The verb sends nothing. It moves the clock and writes one number — the last day
// that has fully elapsed — and the next turn the player sends for their own
// reasons carries the wrap-up. The ruled staging variant is the simple one: ANY
// completed sleep owes EVERY elapsed day, read after the advance, with no
// crossing detection and no captured day-before.
{
  const P = loadedPF.player;
  const E = loadedPF.economy;
  let chats = 0;
  const sleeper = ({ day = 4, clockMin = 21 * 60, home = "inn", zone = "inn" } = {}) => {
    const w = world.build(7, "cozy-village", null);
    const sim = new loadedPF.Sim(w);
    sim.clockMin = clockMin;
    sim.day = day;
    sim.resolveSchedules();
    const sent = [];
    let dirty = 0;
    const core = {
      chatId: `chat-sleep-${++chats}`,
      sim,
      host: { chatMeta: {}, sendMessage: async (text) => (sent.push(text), true) },
      hud: { toast() {}, refreshChips() {} },
      markDirty() {
        dirty++;
      },
    };
    sim.teleport(zone, 3, 3);
    sim.step(0, {});
    if (home) P.setHome(core, home);
    return { w, sim, core, sent, dirty: () => dirty };
  };
  const owedOf = (sim) => sim.intro?.ledgerOwed;

  try {
    // ── A COMPLETED SLEEP OWES EVERY DAY THAT IS OVER ─────────────────────────
    {
      const at = sleeper({ day: 4, clockMin: 21 * 60 });
      const out = E.sleep(at.core, "dawn");
      assert.equal(out.ok, true, "a bed and a daypart is a night's sleep");
      assert.equal(at.sim.day, 5, "the target was behind the clock, so the day rolled");
      assert.equal(at.sim.clockMin, loadedPF.DAYPART_STARTS.dawn, "…and landed on the daypart asked for");
      assert.equal(owedOf(at.sim), 4, "and the day that ended is owed to the wrap-up");
      assert.equal(out.owed, 4, "…which the verb says out loud");
      assert.deepEqual(at.sent, [], "SENDS NOTHING — no turn, no narration, no await");
      assert.ok(at.dirty() >= 1, "and flags the save, because a marker nobody wrote down is no marker");
    }

    // ── THE RULED CASE: A SLEEP THAT CROSSES NOTHING STILL STAGES ─────────────
    // 00:30, four hours after a session ran through midnight. The clock does not
    // move a day and the sleep does not cross one, and yesterday is still over —
    // which is the whole of why the ruling is `day - 1` and not a crossing test.
    {
      const at = sleeper({ day: 6, clockMin: 30 });
      assert.equal(E.sleep(at.core, "dawn").ok, true, "a half-hour lie-down is a completed sleep");
      assert.equal(at.sim.day, 6, "the day did not move");
      assert.equal(at.sim.clockMin, loadedPF.DAYPART_STARTS.dawn, "…the clock did");
      assert.equal(owedOf(at.sim), 5, "and day 5 is owed — the ruled variant, with no crossing to detect");
    }

    // ── THE MARKER ONLY EVER CLIMBS ──────────────────────────────────────────
    // Sleeps accumulate, and a rewind can take the clock backwards under a marker
    // that was already promised. `max` is what stops a later sleep un-owing days.
    {
      const at = sleeper({ day: 4, clockMin: 21 * 60 });
      at.sim.intro = { world: false, zones: {}, npcs: {}, ledgerOwed: 9 };
      E.sleep(at.core, "dawn");
      assert.equal(owedOf(at.sim), 9, "a smaller day never lowers the marker");
      at.sim.day = 12;
      E.sleep(at.core, "night");
      assert.equal(owedOf(at.sim), 11, "…and a larger one raises it");
    }

    // ── WAIT NEVER STAGES, WHICH IS THE OTHER HALF OF THE RULE ───────────────
    // A rest in the open is not a wrap-up. The homeless player is an accepted
    // never-flush class (§5), and this is the line that makes it true.
    {
      const at = sleeper({ day: 4, clockMin: 21 * 60, home: null, zone: "village" });
      assert.equal(at.sim.waitUntil("dawn"), true, "the bedless player can still wait the night out");
      assert.equal(at.sim.day, 5, "…and the clock runs exactly as far");
      assert.equal(owedOf(at.sim), undefined, "but nothing is owed, because nobody sat down and looked back");
      const refused = E.sleep(at.core, "dawn");
      assert.deepEqual(
        [refused.ok, refused.reason],
        [false, "no-bed"],
        "and pressing Sleep without a bed refuses with its own value",
      );
      assert.equal(owedOf(at.sim), undefined, "…still staging nothing");
    }

    // ── THE BED IS A ROOM YOU HOLD, and the refusals around it ────────────────
    {
      const away = sleeper({ home: "inn", zone: "village" });
      assert.equal(E.sleepOffer(away.core).reason, "no-bed", "a berth you are not standing in is not a bed");

      const talking = sleeper();
      talking.sim.mode = "dialogue";
      const mid = E.sleep(talking.core, "dawn");
      assert.deepEqual([mid.ok, mid.reason], [false, "wrong-mode"], "you cannot sleep through a conversation");
      assert.equal(E.sleepOffer(talking.core).bed, true, "…and the button still says there is a bed here");

      const streaming = sleeper();
      streaming.core.host.isStreaming = true;
      const busy = E.sleep(streaming.core, "dawn");
      assert.deepEqual([busy.ok, busy.reason], [false, "streaming"], "nor through narration nobody has read yet");

      const gated = sleeper();
      loadedPF.save.gate = { chatId: gated.core.chatId, state: "generating" };
      const held = E.sleep(gated.core, "dawn");
      assert.deepEqual([held.ok, held.reason], [false, "gate-held"], "nor in a world still being written");
      loadedPF.save.gate = null;

      // …AND A TARGET THAT IS NOT A DAYPART. Driven through the inherited names
      // too: `PF.DAYPART_STARTS["constructor"]` is a FUNCTION on a bare read, and
      // waitUntil's own-property guard is what stops it becoming a clock.
      const odd = sleeper();
      for (const target of ["elevenses", "constructor", "toString", "__proto__", ""]) {
        const out = E.sleep(odd.core, target);
        assert.deepEqual([out.ok, out.reason], [false, "unknown-target"], `"${target}" is not a time of day`);
      }
      assert.equal(odd.sim.clockMin, 21 * 60, "…and not one minute was spent on any of them");
      assert.equal(owedOf(odd.sim), undefined, "…nor anything staged");

      // …AND EVERY REFUSAL HAS THE SAME SHAPE, which is `fish()`'s beside it: a
      // refusal is the NOTHING-HAPPENED shape, all the way down. The reasons are
      // distinct on purpose and the numbers must not be, or a caller reading
      // `result.day` learns which KIND of refusal it got by accident — and reads a
      // live clock off a call that moved nothing.
      const nothing = { ok: false, day: 0, clockMin: 0, owed: 0 };
      assert.deepEqual(E.sleep(odd.core, "elevenses"), { ...nothing, reason: "unknown-target" }, "a bad target");
      assert.deepEqual(E.sleep(away.core, "dawn"), { ...nothing, reason: "no-bed" }, "…and a refused offer");
      assert.deepEqual(E.sleep(talking.core, "dawn"), { ...nothing, reason: "wrong-mode" }, "…and a wrong moment");
    }

    // ── THE ARC'S HEADLINE, END TO END ────────────────────────────────────────
    // The maintainer's ruled scenario, played out: fish through midnight, walk
    // back to the room, bed down at 00:30, and the NEXT accepted turn tells the
    // GM about the night before — INCLUDING the fish landed in the window that
    // crossed. Every part of that is a separate mechanism (the per-day session
    // split, the `day - 1` staging, the compose window, the burn), and this is
    // the only case that asks whether they add up to the sentence the ruling
    // promised.
    {
      const at = sleeper({ day: 5, clockMin: 23 * 60 + 45, home: "inn", zone: "village" });
      at.sim.teleport("village", 32, 23);
      at.sim.step(0, {});
      assert.equal(
        at.sim.nearFeature?.id,
        "legacy:pond",
        "the player is at the pond bank, a quarter hour before midnight",
      );
      P.grant(at.core, { t: "rod", k: "crude" }, 1);
      P.equip(at.core, "fishing", "tool", { t: "rod", k: "crude" });
      P.award(at.core, { xp: 5 * 4 * 3, verb: "fishing" }); // level 4, so the window yields

      const crossing = E.fish(at.core, null);
      assert.equal(at.sim.day, 6, "the cast crossed midnight");
      assert.deepEqual(crossing.days, [5], "…and filed itself under the day it BEGAN in");
      assert.equal(crossing.caught.length, 1, "…having landed something");
      const fish = E.describe(at.w, crossing.caught[0]);
      E.fish(at.core, null);
      E.fish(at.core, null);
      assert.equal(at.sim.clockMin, 30, "two more casts put the clock at 00:30");

      // …the walk back to the room, and the bed.
      at.sim.teleport("inn", 3, 3);
      at.sim.step(0, {});
      assert.equal(E.sleep(at.core, "dawn").ok, true, "and the 00:30 sleeper sleeps");
      assert.equal(at.sim.day, 6, "the sleep crossed no midnight of its own");
      assert.equal(owedOf(at.sim), 5, "…and day 5 is what it owes");

      // THE NEXT TURN THE PLAYER SENDS FOR THEIR OWN REASONS.
      const prefix = at.sim.composePrefix(null);
      const part = prefix.slice(prefix.indexOf("[Wrap-up"));
      assert.ok(part.includes("Day 5: Fished"), `the wrap-up tells day 5 (${part})`);
      assert.ok(part.includes(fish), `…INCLUDING the fish the crossing window landed (${fish})`);
      assert.ok(!part.includes("Day 6"), "and says nothing about the day the player is still living");
      assert.equal(at.sim._pendingIntro.ledger.throughDay, 5, "the burn this turn would take reaches day 5");
      assert.equal(
        P.flush(at.core, at.sim._pendingIntro.ledger.throughDay, at.sim._pendingIntro.ledger.notices),
        true,
        "…and is a legal one",
      );
      assert.equal(P.get(at.core).flushedDay, 5, "so the night is told exactly once");
      assert.equal(at.sim.composePrefix(null), at.sim.header(), "and the turn after it has nothing to add");
    }
  } finally {
    loadedPF.save.gate = null;
    loadedPF.save.reset();
  }
}

// ── THE TRAVEL SENDER CAPTURES ITS OWN TURN (0.12 slice 4) ───────────────────
// The burn hangs off an await, and there are two wrong ways to reach it that
// both look right. Re-reading `sim._pendingIntro` after the send finds the null
// `commitIntro` just wrote and burns NOTHING — for the rest of the save, so the
// wrap-up is re-told on every single turn. Reading the stash fresh finds whatever
// a sender that interleaved composed instead. The reference is captured before
// the await and survives the wholesale null, which is the only version that burns
// the turn that was actually sent.
//
// Driven through the real PF.spatial.travel, because that is where the capture
// lives. The Talk sender is the same shape in 90-element, which this harness
// cannot load (it wants a custom-element registry and a page).
{
  const P = loadedPF.player;
  const prevGetSpatial = loadedPF.api.getSpatial;
  loadedPF.api.getSpatial = async () => ({
    definition: { revision: 3 },
    currentLocationId: "root",
    breadcrumb: [{ name: "root" }],
    destinations: [{ id: "bar", name: "The Bar" }],
  });
  const sent = [];
  const w = world.build(77, "cozy-village", null);
  const sim = new loadedPF.Sim(w);
  sim.day = 6;
  sim.intro = { world: false, zones: {}, npcs: {}, ledgerOwed: 5 };
  const core = {
    chatId: "chat-travel-burn",
    sim,
    host: { packageId: "pixelforge", chatMeta: {}, sendMessage: async (text) => (sent.push(text), true) },
    hud: { toast() {}, refreshChips() {} },
    markDirty() {},
  };
  try {
    P.get(core).ledger.lines.push([4, "Fished the millpond — 12 casts: carp x2."]);
    P.notice(P.get(core), "A task you had taken on has no one left to hand it back to, so you have let it go.", 4);
    loadedPF.spatial.reset();
    await loadedPF.spatial.refresh(core);
    await loadedPF.spatial.travel(core, { id: "bar", name: "The Bar" });
    assert.equal(sent.length, 1, "the journey sent its turn");
    assert.ok(sent[0].includes("[Wrap-up — Day 4: Fished the millpond"), `…carrying the wrap-up (${sent[0]})`);
    assert.ok(sent[0].endsWith("We travel to The Bar."), "…before the player's own action text, at the end");
    assert.equal(P.get(core).flushedDay, 4, "and the ACCEPTED turn burned it");
    assert.equal(P.get(core).ledger.notices[0][2], 1, "…band and all");
    assert.equal(sim._pendingIntro, null, "commitIntro nulled the stash, which is why the capture is closure-local");

    // AND A REFUSED TURN BURNS NOTHING. Same journey, same tell, `false` back
    // from the host: the days stay owed and the notice stays untold.
    const refused = new loadedPF.Sim(w);
    refused.day = 6;
    refused.intro = { world: false, zones: {}, npcs: {}, ledgerOwed: 5 };
    core.sim = refused;
    core.chatId = "chat-travel-refused";
    core.host.sendMessage = async () => false;
    P.get(core).ledger.lines.push([4, "Fished the millpond — 12 casts: carp x2."]);
    P.notice(P.get(core), "A task you had taken on has no one left to hand it back to, so you have let it go.", 4);
    loadedPF.spatial.pending = null;
    await loadedPF.spatial.travel(core, { id: "bar", name: "The Bar" });
    assert.equal(P.get(core).flushedDay, 0, "a refused turn is not a telling");
    assert.equal(P.get(core).ledger.notices[0][2], undefined, "…and its band is still owed to somebody");
  } finally {
    loadedPF.api.getSpatial = prevGetSpatial;
    loadedPF.spatial.reset();
    loadedPF.save.reset();
  }
}

// ═══ THE STORED BRIEF IS UNTRUSTED ON THE LOAD PATH (#566) ═══════════════════
// validate() seals a brief ONCE and the guarantee stops there. `_configBrief`
// hands back `meta.pixelforgeBrief` exactly as stored and build()'s gate asks
// only about its SHAPE, so a dozen reads inside compile() index tables with
// values nothing ever vetted. Measured on this fixture before the fold: a stored
// `prosperity: "constructor"` compiled 10 zones where the brief asks for 37, with
// no warning of any kind, and a stored `scale` or `place.kind` naming a prototype
// method threw into build()'s catch-all and served the 3-zone legacy layout in
// place of a town.
//
// The fold sits at build()'s door, on a private copy, and deliberately NOT in
// `_configBrief`. That placement is the whole design and it has its own two cases
// at the end of this section: the object the save path holds is what
// briefHashOf() stamps a save against, and a load that handed back different
// bytes than it was given would sever an honest save from its own unchanged
// world.
{
  const P = loadedPF.player;
  const seed566 = 566566;
  const brief566 = () =>
    brief.validate(
      {
        scale: "town",
        name: "Mossbrook",
        prosperity: "modest",
        surround: "fields",
        features: [{ tag: "market-stalls" }, { tag: "shrine" }],
        places: [
          { kind: "gathering", name: "The Amber Hearth" },
          { kind: "hall", name: "Moot Hall" },
          { kind: "wilds", name: "Thornwood", features: [{ tag: "dense-growth" }] },
        ],
        cast: [
          { name: "Alder Vance", role: "mayor", kind: "leader", tint: "blue", home: "Mossbrook", household: 1 },
          { name: "Nessa Vance", role: "daughter", kind: "folk", tint: "violet", home: "Mossbrook", household: 1 },
          {
            name: "Perrin Quill",
            role: "innkeep",
            kind: "host",
            tint: "amber",
            home: "The Amber Hearth",
            household: 2,
          },
          { name: "Old Sera", role: "weaver", kind: "elder", tint: "rose", home: "Mossbrook", household: 3 },
          { name: "Brint", role: "farmhand", kind: "grower", tint: "green", home: "Mossbrook", household: 4 },
          { name: "Marla", role: "smith", kind: "maker", tint: "teal", home: "Mossbrook", household: 5 },
        ],
      },
      { theme: "cozy-village", seed: seed566 },
    );
  const planted = (mutate) => {
    const stored = brief566();
    mutate(stored);
    return stored;
  };
  const tiles = (w) => JSON.stringify(w.zones);
  const built = (stored) => {
    const warned = [];
    const realWarn = console.warn;
    console.warn = (...args) => warned.push(args.map(String).join(" "));
    try {
      return { w: world.build(seed566, "cozy-village", stored), warned };
    } finally {
      console.warn = realWarn;
    }
  };

  // (i) A HOSTILE `prosperity` COMPILES THE DEFAULT'S WORLD, NOT A QUARTER OF ONE.
  // `HOUSEHOLD_LEAN[brief.prosperity] ?? 1` is the read that did the damage: a
  // prototype key is not undefined, so the `?? 1` never fired, the household
  // arithmetic multiplied by a function, and the settlement came out a fraction of
  // its own size. The fold makes it the world "modest" already means — the same
  // TILES, not merely the same zone tally.
  {
    const honest = built(brief566());
    assert.equal(honest.warned.length, 0, "an honest brief says nothing on the way through the fold");
    const hostile = built(planted((stored) => (stored.prosperity = "constructor")));
    assert.equal(
      Object.keys(hostile.w.zones).length,
      Object.keys(honest.w.zones).length,
      "a hostile prosperity compiles the DEFAULT prosperity's zone count, not a silent fraction of it",
    );
    assert.equal(tiles(hostile.w), tiles(honest.w), "…down to the tiles, because the fold's default IS `modest`");
    assert.deepEqual(hostile.w.briefFolds, ['prosperity: "constructor" -> "modest"'], "and the world says what moved");
    assert.ok(
      hostile.warned.some((line) => line.includes("this build does not know")),
      "…out loud, which is the half that made the loss a bug rather than a degrade",
    );
    // Non-vacuous: prosperity really does move this fixture's size, so a case that
    // asserts "same as the default" is asserting something.
    const thriving = built(planted((stored) => (stored.prosperity = "thriving")));
    assert.notEqual(
      Object.keys(thriving.w.zones).length,
      Object.keys(honest.w.zones).length,
      "the fixture is one whose zone count actually answers to prosperity",
    );
  }

  // (ii) A HOSTILE `scale` STILL COMPILES ITS OWN SETTLEMENT, NOT THE LEGACY THREE.
  // `SCALES[brief.scale] || SCALES.village` looks defended and is not: the
  // prototype entry is truthy, so `scale.w` was undefined and makeZone threw. The
  // catch-all above swallowed it and the player got the fixed four-NPC village
  // that pre-brief saves compile to — a whole generated world gone behind one
  // console.warn.
  {
    const hostile = built(planted((stored) => (stored.scale = "constructor")));
    assert.equal(hostile.w.brieved, true, "a hostile scale still compiles the BRIEF's world");
    const legacy = world.build(seed566, "cozy-village");
    assert.ok(
      Object.keys(hostile.w.zones).length > Object.keys(legacy.zones).length,
      `…and not the ${Object.keys(legacy.zones).length}-zone legacy layout it used to degrade to`,
    );
    assert.equal(
      tiles(hostile.w),
      tiles(built(planted((stored) => (stored.scale = "village"))).w),
      "it is exactly the world the fold's default rank builds",
    );
    assert.deepEqual(hostile.w.briefFolds, ['scale: "constructor" -> "village"'], "and the fold is on the record");
  }

  // (iii) A PLACE KIND NAMING A PROTOTYPE METHOD IS FOLDED BEFORE IT CAN BE READ.
  // Pre-fold the compile died at `INTERIOR_DIMS[kind] || INTERIOR_DIMS.dwelling`
  // — destructuring Object.prototype.toString as a dimensions pair (a function
  // is not iterable) — which fires BEFORE the FURNISH table would have invoked it
  // unbound. Same bug class, earlier line; either way the whole generated world
  // fell to the 3-zone legacy layout. The fold hands every kind-keyed table
  // "dwelling", the entry their fallbacks were already reaching for.
  {
    const hostile = built(planted((stored) => (stored.places[0].kind = "toString")));
    assert.equal(hostile.w.brieved, true, "the furnisher was never invoked — the compile completed");
    assert.ok(zoneNamed(hostile.w, "The Amber Hearth"), "the named place still has its zone");
    assert.equal(
      tiles(hostile.w),
      tiles(built(planted((stored) => (stored.places[0].kind = "dwelling"))).w),
      "furnished as a dwelling, which is what an unrecognised kind already fell back to",
    );
    assert.deepEqual(hostile.w.briefFolds, ['places[0].kind: "toString" -> "dwelling"'], "and it is on the record");
  }

  // (iii-b) A FEATURE TAG IS THE ONE FOLD WHOSE FALLBACK IS `null` RATHER THAN A
  // WORD, and the only one whose value survives the compile into a registry row.
  // The fold comment calls an unknown tag "already a plain rect with no painter",
  // and for an ordinary unknown word it is — but the read that decides the rect is
  // BARE (`FEATURE_RECTS[feature.tag] ?? FEATURE_RECT`, 20-world), so a tag naming
  // a prototype method resolves to a FUNCTION, the `??` cannot fire, and the size
  // spread into the register carries no `w` and no `h` at all. Folding to null is
  // what puts a real rect back. The row keeps its NAME either way, which is the
  // half that lets the registry still say what stands there.
  {
    const hostile = built(planted((stored) => (stored.features[0].tag = "valueOf")));
    assert.equal(hostile.w.brieved, true, "an unknown feature tag still compiles the brief's world");
    assert.deepEqual(hostile.w.briefFolds, ['features[0].tag: "valueOf" -> null'], "and the fold is on the record");
    const rows = Object.values(hostile.w.zones).flatMap((zone) => zone.features ?? []);
    // Against the VOCABULARY, not against `typeof`: a prototype key is a perfectly
    // good string, so a type test here would pass just as happily on the unfolded
    // row and pin nothing at all.
    assert.ok(
      rows.every((row) => row.tag === null || brief.FEATURE_TAGS.includes(row.tag)),
      "no registry row carries a tag outside the shipped vocabulary",
    );
    assert.ok(
      rows.every((row) => Number.isFinite(row.rect.w) && Number.isFinite(row.rect.h)),
      "…and every row still has a rect with real sides, which the bare read could not give it",
    );
    const folded = rows.filter((row) => row.tag === null);
    assert.equal(folded.length, 1, "exactly the one folded feature lost its tag");
    assert.ok(folded[0].name, "…and it kept the name the registry answers with");
  }

  // (iv) THE SEVERANCE RED. An honest save loads, and loads again, and is never
  // severed — because the fold never touches the object identity is computed from.
  //
  // The fixture is chosen to be the one a re-validate would have broken: its cast
  // is under the floor, so sealing topped it up from STOCK, and a stock member's
  // key order is not the main path's. Re-validating that brief on read returns the
  // same VALUES in different BYTES, which is a different briefHash, which is a
  // severance for a world that did not change. The last assertion in this block
  // pins that hazard as real rather than imagined.
  {
    const larkmoor = { scale: "village", name: "Larkmoor", cast: [{ name: "Solo", kind: "leader" }] };
    const sealed = brief.validate(larkmoor, { theme: "cozy-village", seed: seed566 });
    assert.ok(sealed._repairs.length > 0, "the fixture is a brief that took repairs at seal time");
    const storedBytes = JSON.stringify(sealed);
    const meta = { pixelforgeBrief: sealed };
    const w = world.build(seed566, "cozy-village", sealed);
    const stamps = P.stampsFor(w, sealed);

    const played = P.defaultPlayer();
    played.world = { ...stamps };
    played.rel = { z1: { Solo: { d: 3, t: 9 } } };
    played.home = "z1";
    played.pouch.money = 12;
    const row = { v: 1, seed: seed566, theme: "cozy-village", player: P.serialize(played) };

    const severedNotice = (sim) =>
      (sim.player.ledger.notices ?? []).some(([, text]) => /set aside|are not the people/.test(text));

    const first = loadedPF.save.simFromSaved(row, meta, "chat-566");
    assert.equal(first.world.brieved, true, "the honest save loads into its own compiled world");
    assert.equal(severedNotice(first), false, "and nothing was severed");
    assert.deepEqual(first.player.rel.z1.Solo, { d: 3, t: 9 }, "the relationship row is intact");
    assert.equal(first.player.home, "z1", "…and so is the home");
    assert.equal(first.player.world.briefHash, stamps.briefHash, "the block re-stamps to the same brief hash");

    // THE SAME SAVE, THROUGH THE SAME SEAM, A SECOND TIME. This is the shape a
    // spurious severance actually takes: not one bad load, but a world that never
    // agrees with itself twice running.
    const again = { ...row, player: P.serialize(first.player) };
    const second = loadedPF.save.simFromSaved(again, meta, "chat-566");
    assert.equal(severedNotice(second), false, "the second load severs nothing either");
    assert.deepEqual(second.player.rel.z1.Solo, { d: 3, t: 9 }, "the row survived both trips");
    assert.equal(second.player.home, "z1", "and the home with it");

    // BYTE-IDENTITY ON WHAT THE COMPARISON ACTUALLY CONSUMES. briefHashOf() hashes
    // `JSON.stringify(brief)` over the object `_configBrief` returns, so the pin is
    // that the reader still returns the STORED OBJECT — not a copy of it, not a
    // fold of it — and that two loads left its bytes exactly where they were.
    assert.equal(
      loadedPF.save._configBrief(meta, "chat-566"),
      sealed,
      "the load path returns the stored object itself",
    );
    assert.equal(JSON.stringify(meta.pixelforgeBrief), storedBytes, "and two loads did not move one byte of it");
    assert.equal(P.briefHashOf(meta.pixelforgeBrief), stamps.briefHash, "so the identity is the one it always was");

    // …AND THE HAZARD IS REAL. Had the fold been put in `_configBrief`, THIS is the
    // number the second load would have compared against.
    const revalidated = brief.validate(JSON.parse(storedBytes), { theme: sealed.theme, seed: seed566 });
    assert.notEqual(
      P.briefHashOf(revalidated),
      stamps.briefHash,
      "an honest brief does NOT re-validate to its own bytes — folding on the read path would sever it from itself",
    );

    // AND THE MACHINERY IS NOT DEADENED. A brief that genuinely moved still severs.
    const other = brief.defaults("sci-fi-colony", seed566);
    const moved = loadedPF.save.simFromSaved(again, { pixelforgeBrief: other }, "chat-566-moved");
    assert.equal(severedNotice(moved), true, "a brief that really changed still severs");
    assert.deepEqual(moved.player.rel, {}, "…and still takes the world-bound rows with it");
    loadedPF.quarantine.reset();
    loadedPF.save.reset();
  }

  // (v) FORWARD COMPAT: AN UNKNOWN-BUT-HONEST VALUE FOLDS, LEAVES A TRACE, AND
  // WRITES NOTHING BACK. This is the path that makes the whole thing reachable
  // without a hostile save: a newer build adds a vocabulary entry, an older build
  // reads the brief it wrote. What that build owes is the default and a sentence,
  // not a silently smaller world — and NOT a repair written back over the newer
  // build's own brief, which is why the fold's `_folds` never leaves the copy.
  {
    const stored = planted((draft) => {
      draft.surround = "marsh";
      draft.cast[1].standing = "pilgrim";
    });
    const storedBytes = JSON.stringify(stored);
    const row = { v: 1, seed: seed566, theme: "cozy-village", player: P.serialize(P.defaultPlayer()) };
    const realWarn = console.warn;
    const warned = [];
    console.warn = (...args) => warned.push(args.map(String).join(" "));
    let sim;
    try {
      sim = loadedPF.save.simFromSaved(row, { pixelforgeBrief: stored }, "chat-566-future");
    } finally {
      console.warn = realWarn;
    }
    assert.equal(sim.world.brieved, true, "the older build still compiles the newer build's world");
    assert.deepEqual(
      sim.world.briefFolds,
      ['surround: "marsh" -> "rocky"', 'cast[1].standing: "pilgrim" -> "resident"'],
      "each unknown value folded to the default, and the world carries the trace a debugger can read",
    );
    assert.ok(
      warned.some((line) => line.includes("this build does not know")),
      "…and the console was told as well",
    );
    assert.equal(
      Object.keys(sim.world.zones).length,
      Object.keys(built(brief566()).w.zones).length,
      "and nothing was DROPPED for being unrecognised — a read-side fold folds, it never removes",
    );
    assert.equal(JSON.stringify(stored), storedBytes, "the stored brief is byte-for-byte what the newer build wrote");
    assert.equal("_folds" in stored, false, "the repair trace never leaks back onto the stored metadata");
    loadedPF.save.reset();
  }

  // (vi) WHY THE FOLD IS NOT A SECOND validate(), pinned so nobody simplifies it
  // into one. Two properties, both measured, and either one alone rules validate()
  // out of the load path.
  {
    // ONE: it is not byte-idempotent, so its output can never be what a save's
    // identity is computed from. (Case (iv) drives the consequence; this is the
    // property.)
    const source = { scale: "village", name: "Larkmoor", cast: [{ name: "Solo", kind: "leader" }] };
    const repaired = brief.validate(source, { theme: "cozy-village", seed: seed566 });
    const again = brief.validate(JSON.parse(JSON.stringify(repaired)), { theme: "cozy-village", seed: seed566 });
    assert.notEqual(
      JSON.stringify(again),
      JSON.stringify(repaired),
      "validate() does not return a sealed brief's bytes",
    );

    // TWO: it re-runs the seal-time CAPS. A brief whose rank says less ground than
    // its content asks for loses places on every load — which is the very silent
    // zone loss this section exists to close, arriving through the front door.
    const shrunk = brief566();
    shrunk.scale = "outpost";
    assert.ok(
      brief.validate(JSON.parse(JSON.stringify(shrunk)), { theme: "cozy-village", seed: seed566 }).places.length <
        shrunk.places.length,
      "re-validating on read would DROP places the sealed brief named",
    );
    assert.equal(
      brief.foldStored(shrunk, seed566).places.length,
      shrunk.places.length,
      "…and the fold keeps every one of them, because read time may only fold",
    );

    // THREE: validate() mutates its argument on the leader-hoist path, which is
    // the other way a load could rewrite the bytes a save is stamped against.
    const hoist = { scale: "village", name: "Hoist", cast: [] };
    for (let i = 0; i < 12; i++) hoist.cast.push({ name: `P${i}`, kind: i === 11 ? "leader" : "folk" });
    const beforeHoist = JSON.stringify(hoist);
    brief.validate(hoist, { theme: "cozy-village", seed: seed566 });
    assert.notEqual(JSON.stringify(hoist), beforeHoist, "validate() reorders the cast it was handed");
    const untouched = planted(() => {});
    const beforeFold = JSON.stringify(untouched);
    brief.foldStored(untouched, seed566);
    assert.equal(JSON.stringify(untouched), beforeFold, "…and foldStored() never touches the object it was handed");
  }

  // (vii) THE THEME FOLD ASKS THE ART MODULE RATHER THAN KEEPING A LIST OF ITS
  // OWN. `brief.theme` is spent on exactly ONE read downstream of the fold —
  // `PF.art.setTheme(brief.theme)` (20-world) — so 10-art's table is the whole
  // vocabulary this fold answers to, and a second copy of it here could only
  // drift out of it. The drift is the future-theme divergence class the roadmap's
  // swamp-biome prerequisites already track (LEGACY_ROLES skipping an unlisted
  // theme in silence is the same shape): an art-only theme folded here would
  // replace a VALID theme with the default, one screen before setTheme() would
  // have accepted it (review).
  {
    const realThemeIds = loadedPF.art.themeIds;
    const themed = (id) => {
      const stored = planted((draft) => (draft.theme = id));
      return brief.foldStored(stored, seed566)._folds;
    };
    try {
      // The steady state first: this build's own themes move nothing, and a word
      // that is not a theme still folds, so the whitelist is still a whitelist.
      for (const id of realThemeIds()) assert.deepEqual(themed(id), [], `"${id}" is a theme, so nothing moves`);
      assert.deepEqual(
        themed("swamp-biome"),
        ['theme: "swamp-biome" -> "cozy-village"'],
        "a theme nothing in this build answers for still folds to the default",
      );
      // THE PIN. A build that ships a third theme is exactly this — one more id
      // out of the art module — and the fold has to read that AT FOLD TIME to see
      // it. A load-time copy of the list folds the newer build's honest theme
      // away and hands the compiler cozy-village instead.
      loadedPF.art.themeIds = () => [...realThemeIds(), "swamp-biome"];
      assert.deepEqual(themed("swamp-biome"), [], "a theme the art module answers for is one the fold leaves alone");
    } finally {
      loadedPF.art.themeIds = realThemeIds;
    }
  }

  // (viii) A DEGRADE NAMES THE FOLDS AS WELL. When the FOLDED brief throws
  // anyway, build()'s catch-all is the only line anybody gets, and the folded
  // values are the only ones that moved between what was stored and what the
  // compiler read — the likeliest explanation, and the one thing the line did
  // not carry (review).
  {
    // A brief that clears the shape gate and dies inside the compile: `_ids.zones`
    // of null is `typeof "object"`, so the door opens, and the zone index built
    // from `Object.entries(brief._ids.zones)` throws on the first read. It carries
    // a foldable value too, which is what the warning owes the next reader.
    const doomed = planted((draft) => {
      draft.prosperity = "constructor";
      draft._ids.zones = null;
    });
    const degraded = built(doomed);
    assert.notEqual(degraded.w.brieved, true, "the folded brief failed to compile, so the world degraded as before");
    const line = degraded.warned.find((text) => text.includes("failed to compile"));
    assert.ok(line, "the degrade is still announced");
    assert.ok(line.includes('prosperity: "constructor" -> "modest"'), "…and the line names the value the fold moved");
  }
}

// ── A DOM the size of the two surfaces that need one ──────────────────────────
// Not a browser: exactly what PF.el touches (createElement, style, text,
// attributes, listeners, children) plus fire(), so a click can be driven. Enough
// for 70-hud's layout and 80-setup's launch config, which is all this file asks.
class FakeNode {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.style = {};
    this.children = [];
    this.attrs = {};
    this.listeners = {};
    this.textContent = "";
  }
  setAttribute(name, value) {
    this.attrs[name] = value;
    // Real inputs reflect the value/type attributes onto the property, and the
    // wizard reads `.value`; nothing else here needs reflecting.
    if (name === "value" || name === "type") this[name] = value;
  }
  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null;
  }
  addEventListener(type, fn) {
    (this.listeners[type] ??= []).push(fn);
  }
  removeEventListener() {}
  appendChild(node) {
    this.children.push(node);
    return node;
  }
  replaceChildren(...nodes) {
    this.children = nodes;
  }
  remove() {}
  // ── THE NAMED SHIM EXTENSION (plan §6) ─────────────────────────────────────
  // Three additions, all of them for ONE guard: `_hostOwnsKeyboard`
  // (90-element), which is what stands between the `C` hotkey and a player
  // typing into the host's message box. Without them the sheet's guard lanes
  // migrate silently to browser-only, which is where a guard goes to stop being
  // watched.
  //
  // (i) A node can have a SIZE. The guard measures a modal before believing in
  // it, because the toast container is a permanently-mounted zero-size panel and
  // the first live playtest showed a broad test misfiring on it. `_rect` is what
  // a case stages; nothing in the package reads it.
  getBoundingClientRect() {
    const rect = this._rect ?? {};
    return { width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, ...rect };
  }
  // (ii) …and a node can be asked whether the focused element is INSIDE it,
  // which is the difference between the player typing into a host input and the
  // player having just clicked one of our own buttons.
  contains(node) {
    if (!node) return false;
    if (node === this) return true;
    return this.children.some((child) => (child.contains ? child.contains(node) : false));
  }
}
/** The staged-list matcher: exactly the `[attr="value"]` form the one shipped
 *  selector uses, and no more. A staged node that carries `role` but not
 *  `aria-modal` is correctly NOT found, which is the half a "return everything
 *  staged" shim would quietly get wrong. */
const stagedMatches = (node, selector) => {
  const parts = String(selector).match(/\[[^\]]+\]/g) ?? [];
  if (!parts.length) return false;
  return parts.every((part) => {
    const pair = part.match(/^\[([^=\]]+)="([^"]*)"\]$/);
    return !!pair && node.getAttribute(pair[1]) === pair[2];
  });
};
// (iii) The document-level half: focus is a document fact rather than a node
// one, so `activeElement` is settable, and `querySelectorAll` reads a staged
// list a case puts in front of the guard.
globalThis.document = {
  createElement: (tag) => new FakeNode(tag),
  body: new FakeNode("body"),
  documentElement: new FakeNode("html"),
  activeElement: null,
  _staged: [],
  querySelectorAll(selector) {
    return this._staged.filter((node) => stagedMatches(node, selector));
  },
};
const walkNodes = (node, out = []) => {
  out.push(node);
  for (const child of node.children) walkNodes(child, out);
  return out;
};
const fire = (node, type) => Promise.all((node.listeners[type] ?? []).map((fn) => fn({ preventDefault() {} })));

// ── A LOCATION NOTICE DOES NOT LAND ON THE NARRATION ──────────────────────────
// Every toast shared one node pinned 156px off the bottom of the surface — which
// is where the host's narration panel is. Crossing into a zone therefore printed
// its name across the middle of the GM's sentence ("Tam's farm" over a line of
// NARRATION, playtest screenshot). Where you have just arrived belongs at the top
// beside the chip that already says where you are; the refusals and receipts keep
// the bottom surface they had.
{
  const realSetTimeout = globalThis.setTimeout;
  const realClearTimeout = globalThis.clearTimeout;
  globalThis.setTimeout = () => 0; // the fade is a timer; nothing here waits for one
  globalThis.clearTimeout = () => {};
  try {
    const hud = new loadedPF.Hud(new FakeNode("div"), { sim: null });
    hud.toast("Tam's farm", "location");
    hud.toast("There is no room to be had here.");
    const shown = walkNodes(hud.root).filter((node) => node.style.opacity === "1");
    assert.equal(shown.length, 2, "an arrival and a refusal are on two different surfaces at once");
    const located = shown.find((node) => node.textContent === "Tam's farm");
    const plain = shown.find((node) => node.textContent !== "Tam's farm");
    assert.ok(located && plain, "…one each");
    assert.ok(/;top:/.test(located.style.cssText), "the location notice is anchored to the TOP of the surface");
    assert.ok(!/bottom:/.test(located.style.cssText), "…and not to the bottom, where the narration is");
    assert.ok(/bottom:/.test(plain.style.cssText), "every other toast keeps the surface it had");
  } finally {
    globalThis.setTimeout = realSetTimeout;
    globalThis.clearTimeout = realClearTimeout;
  }
}

// ── THE BERTH BUTTON IS ON SCREEN WHENEVER THE ROOM IS OFFERING ONE ───────────
// The offer's own contract is pinned in case (ay); this is the half the
// maintainer actually looks at. Second playtest: standing inside The Amber
// Hearth, the action stack held Talk, Wait and Keyboard and nothing else.
//
// The button is a plain child of that stack — there is no collapse chevron on
// this surface and nothing to surface it out of — so what gated it was the offer
// underneath, and `offer.price !== null` is the whole render test. Pinned here
// through the real Hud over the DOM shim so the two halves cannot drift: an
// offer nobody renders is the same bug as no offer at all.
{
  const realSetTimeout = globalThis.setTimeout;
  const realClearTimeout = globalThis.clearTimeout;
  globalThis.setTimeout = () => 0; // the fade is a timer; nothing here waits for one
  globalThis.clearTimeout = () => {};
  loadedPF.save.reset();
  loadedPF.spatial.reset();
  try {
    const sealed = brief.validate(
      {
        scale: "village",
        name: "Hearthvale",
        prosperity: "modest",
        backgroundPopulation: 40,
        situation: "Pumpkins keep going missing from the fair field.",
        places: [{ kind: "gathering", name: "The Amber Hearth", flavor: "A honey-lit inn." }],
        cast: [
          { name: "Mira", role: "Innkeeper", kind: "host", tint: "amber", home: "The Amber Hearth", household: 1 },
          { name: "Rook", role: "Guard Captain", kind: "guard", tint: "blue", home: "The Amber Hearth", household: 1 },
          { name: "Tam", role: "Farmer", kind: "grower", tint: "green", home: "Hearthvale", household: 2 },
        ],
      },
      { theme: "cozy-village", seed: 2095930824 },
    );
    const w = world.build(2095930824, "cozy-village", sealed);
    const gid = Object.entries(sealed._ids.zones).find(([, name]) => name === "The Amber Hearth")?.[0];
    const room = w.zones[gid];
    const keeper = room.npcs.find((npc) => npc.lodging === gid);
    const roommate = room.npcs.find((npc) => !npc.lodging);
    assert.ok(keeper && roommate, "the room has a keeper in it and somebody else besides");

    const sim = new loadedPF.Sim(w);
    const core = { chatId: "chat-berth-hud", sim, interact() {}, setMode() {}, resume() {}, markDirty() {} };
    core.hud = new loadedPF.Hud(new FakeNode("div"), core);
    const hud = core.hud;

    // WHAT IT LOOKS LIKE BEFORE THE FIRST UPDATE, read here and nowhere else.
    // The constructor does not call update() — every assertion below reaches its
    // display through one, so all of them pass whether the button boots hidden or
    // boots visible, and the boot state is a claim only this line makes. It is not
    // cosmetic: a display-gated button that ships visible is on screen for every
    // frame before the first update, and for the whole of a mount that never
    // reaches one (no sim yet), quoting a room in a world that has not compiled.
    assert.equal(hud.berthBtn.style.display, "none", "the berth button boots HIDDEN, before anything has decided");
    assert.ok(
      !hud.talkBtn.style.display,
      "…and Talk beside it is not display-gated at all — it is up for the whole of walk mode and only dims",
    );

    loadedPF.player.award(core, { money: 100 });

    // WHERE IT LIVES: beside Talk in the one action stack, not behind anything.
    assert.ok(hud.actions.children.includes(hud.berthBtn), "the berth button is a direct child of the action stack");
    assert.ok(hud.actions.children.includes(hud.talkBtn), "…the same stack Talk is in");

    const showing = () => {
      hud.update();
      return hud.berthBtn.style.display;
    };
    sim.zoneId = w.startZone;
    sim.nearNpc = null;
    assert.equal(showing(), "none", "out in the square with nobody about, there is nothing to render");

    // THE REPORTED FRAME: inside the inn, nearest to the guard by the door.
    sim.zoneId = gid;
    sim.nearNpc = roommate;
    assert.equal(showing(), "", "standing in the inn puts the button on screen");
    assert.ok(
      hud.berthBtn.textContent.includes(loadedPF.economy.money(w, loadedPF.economy.price(w, "berth"))),
      "…quoting the price in this world's own money",
    );
    assert.equal(hud.berthBtn.style.opacity, "1", "…and offered, not refused");

    // AND THE REFUSALS RENDER RATHER THAN VANISH.
    loadedPF.player.award(core, { money: -100 });
    assert.equal(showing(), "", "a short purse does not hide the price");
    assert.equal(hud.berthBtn.style.opacity, "0.45", "…it dims it");
    loadedPF.player.award(core, { money: 100 });
    hud.update();
    loadedPF.economy.rentBerth(core);
    assert.equal(showing(), "", "and the room you already keep stays on screen");
    assert.equal(hud.berthBtn.textContent, "Your berth", "…saying it is yours");

    // AN EMPTY ROOM RENDERS NOTHING, which is what keeps the button honest.
    const held = room.npcs.splice(room.npcs.indexOf(keeper), 1)[0];
    sim.nearNpc = null;
    assert.equal(showing(), "none", "an inn with nobody behind the counter offers no button");
    room.npcs.push(held);
  } finally {
    globalThis.setTimeout = realSetTimeout;
    globalThis.clearTimeout = realClearTimeout;
    loadedPF.save.reset();
    loadedPF.spatial.reset();
  }
}

// ── THE ACTION STACK'S CENSUS, COUNTED RATHER THAN ASSUMED ───────────────────
// §2.3's honest recount. The old "these are mutually rare" premise is STRUCK:
// Talk is up for the whole of walk mode, keepers wander with no zone
// restriction, and an inn beside a pond puts Talk, Wait, Keyboard, Travel, Fish,
// Berth and Buy-Rod on screen at once by construction. Seven for slice 3; slice
// 4 adds Sleep and the worst case is EIGHT, which is exactly why this is pinned:
// adding a button means recounting here, deliberately, and the recount is what
// the last change to this stack actually failed on.
//
// A DISPLAY-STATE pin over the real Hud on the shim, and not a layout one. The
// shim has no layout engine and this case makes no claim about pixels.
{
  const realSetTimeout = globalThis.setTimeout;
  const realClearTimeout = globalThis.clearTimeout;
  globalThis.setTimeout = () => 0;
  globalThis.clearTimeout = () => {};
  loadedPF.save.reset();
  loadedPF.spatial.reset();
  try {
    const P = loadedPF.player;
    const w = world.build(7, "cozy-village", null);
    const sim = new loadedPF.Sim(w);
    const core = {
      chatId: "chat-census",
      sim,
      interact() {},
      setMode() {},
      resume() {},
      markDirty() {},
    };
    core.hud = new loadedPF.Hud(new FakeNode("div"), core);
    const hud = core.hud;
    const keeper = w.zones.inn.npcs.find((npc) => npc.lodging === "inn");
    assert.ok(keeper, "the fixture has somebody who lets rooms");

    // THE ENUMERATION. Named, so a failure says WHICH button appeared, and
    // cross-checked against the stack's real children so a button added without
    // touching this list fails here rather than passing unnoticed.
    const stack = {
      Talk: hud.talkBtn,
      Berth: hud.berthBtn,
      "Buy-Rod": hud.buyRodBtn,
      Travel: hud.travelBtn,
      Fish: hud.fishBtn,
      Sleep: hud.sleepBtn,
      Wait: hud.waitBtn,
      Keyboard: hud.keyboardBtn,
      Resume: hud.resumeBtn,
    };
    const buttons = hud.actions.children.filter((node) => node.tagName === "BUTTON");
    assert.equal(
      buttons.length,
      Object.keys(stack).length,
      `the census covers every button in the stack (${buttons.length})`,
    );
    for (const node of buttons)
      assert.ok(
        Object.values(stack).includes(node),
        `every button in the stack is named in the census (${node.textContent})`,
      );

    // BEFORE THE FIRST UPDATE, which is a claim only this line makes: a
    // display-gated button that ships visible is on screen for every frame
    // before update() runs, and for the whole of a mount that never reaches one.
    for (const name of ["Berth", "Buy-Rod", "Fish", "Sleep"])
      assert.equal(stack[name].style.display, "none", `${name} boots HIDDEN, before anything has decided`);

    const census = () => {
      hud.update();
      return Object.entries(stack)
        .filter(([, node]) => node.style.display !== "none")
        .map(([name]) => name)
        .sort();
    };
    const standAtPond = () => {
      sim.teleport("village", 32, 23);
      sim.step(0, {});
      assert.equal(sim.nearFeature?.id, "legacy:pond", "the fixture stands at the pond bank");
    };

    P.award(core, { money: 100 });

    // (1) UNDER THE GATE: nothing at all, including the topbar.
    loadedPF.save.gate = { chatId: core.chatId, state: "generating" };
    assert.deepEqual(census(), [], "a world nobody has entered offers no actions");
    assert.equal(hud.topbar.style.display, "none", "…and no chips either");
    loadedPF.save.gate = null;

    // (2) MID-CONVERSATION: the one guaranteed way back out, and nothing else.
    sim.mode = "dialogue";
    assert.deepEqual(census(), ["Resume"], "dialogue keeps exactly the exit");
    sim.mode = "walk";

    // (3) WALKING, NOWHERE IN PARTICULAR: the three that are never proximity-gated.
    sim.teleport("village", 21, 17);
    sim.step(0, {});
    sim.nearNpc = null;
    loadedPF.spatial.available = false;
    assert.deepEqual(census(), ["Keyboard", "Talk", "Wait"], "mid-square with nobody about: three");

    // (4) …WITH SOMEWHERE TO TRAVEL TO.
    loadedPF.spatial.available = true;
    assert.deepEqual(census(), ["Keyboard", "Talk", "Travel", "Wait"], "a known destination adds one");

    // (5) …AND A KEEPER WITHIN REACH, who sells two different things.
    sim.nearNpc = keeper;
    assert.deepEqual(census(), ["Berth", "Buy-Rod", "Keyboard", "Talk", "Travel", "Wait"], "the keeper adds two");

    // (6) STANDING AT THE WATER with the keeper beside you, which an inn built by
    // a pond makes ordinary rather than exotic. Seven, and no bed in sight.
    standAtPond();
    sim.nearNpc = keeper;
    assert.deepEqual(
      census(),
      ["Berth", "Buy-Rod", "Fish", "Keyboard", "Talk", "Travel", "Wait"],
      "seven, and Sleep is not among them — the player has nowhere to sleep",
    );
    assert.equal(hud.fishBtn.style.opacity, "0.45", "…and Fish is offered dimmed to a rodless player, not hidden");
    assert.ok(hud.fishBtn.textContent.includes(w.zones.village.features[0].name), "…naming the water it is about");

    // (7) THE WORST CASE, WHICH IS EIGHT. The bed is the eighth, and it takes a
    // berth held in the zone the player is standing in — staged here rather than
    // walked to, because what the census is about is what the STACK does when all
    // eight co-occur, not which brief produces a bedroom with a pond at the door.
    P.setHome(core, "village");
    assert.deepEqual(
      census(),
      ["Berth", "Buy-Rod", "Fish", "Keyboard", "Sleep", "Talk", "Travel", "Wait"],
      "the full slice-4 stack is EIGHT — recount this when slice 5 adds anything",
    );
    assert.equal(hud.sleepBtn.style.opacity, "1", "…and the bed is offered, not dimmed");
    // …AND IT IS THE BED THAT SHOWS IT, not the room: step out of the zone the
    // berth is in and the button goes with it.
    sim.teleport("inn", 3, 3);
    sim.step(0, {});
    assert.ok(!census().includes("Sleep"), "a bed you are not standing in offers nothing");
    standAtPond();
    sim.nearNpc = keeper;
    assert.ok(census().includes("Sleep"), "and back in the zone it is back");

    // (8) THE LADDER TOPS OUT AND ITS BUTTON GOES, which is the one stated
    // divergence from the berth's never-vanish rule.
    P.grant(core, { t: "rod", k: "decent" }, 1);
    assert.deepEqual(
      census(),
      ["Berth", "Fish", "Keyboard", "Sleep", "Talk", "Travel", "Wait"],
      "a decent rod is the end of that ladder, so the button leaves the stack",
    );
    assert.equal(hud.fishBtn.style.opacity, "1", "…while Fish stops being dimmed, having a rod behind it now");

    // AND WALKING AWAY TAKES THE PROXIMITY ONES WITH IT — including any menu
    // left standing open over water nobody is at.
    hud.toggleFish();
    assert.equal(hud.fishMenu.style.display, "flex", "the session menu opens at the bank");
    assert.ok(
      hud.fishMenu.children.some((node) => node.textContent === "Cast once"),
      "…offering a single cast",
    );
    assert.equal(
      hud.fishMenu.children.filter((node) => /^Fish until /.test(node.textContent)).length,
      4,
      "…and a session for each of the four dayparts, mirroring the Wait menu",
    );
    assert.ok(
      hud.fishMenu.children.some((node) => /No bait/.test(node.textContent)),
      "…with a bait line saying what the session would spend",
    );
    // …and the bed's menu opens the same way, with the Wait menu's own four.
    hud.toggleSleep();
    assert.equal(hud.sleepMenu.style.display, "flex", "the bed's menu opens where the bed is");
    assert.equal(
      hud.sleepMenu.children.filter((node) => /^Sleep until /.test(node.textContent)).length,
      4,
      "…offering the same four dayparts the Wait menu does",
    );
    sim.teleport("village", 21, 17);
    sim.step(0, {});
    sim.nearNpc = null;
    // FIVE, not four: the bed is a ROOM and not a spot, so walking off the bank
    // and away from the keeper leaves it exactly where it was.
    assert.deepEqual(census(), ["Keyboard", "Sleep", "Talk", "Travel", "Wait"], "walking away puts the stack to five");
    assert.equal(hud.fishMenu.style.display, "none", "…and closes the menu the water left open");
    // LEAVING THE ROOM is what takes the bed, and the menu goes with it.
    sim.teleport("inn", 3, 3);
    sim.step(0, {});
    sim.nearNpc = null;
    assert.ok(!census().includes("Sleep"), "a room that is not yours has no bed in it for you");
    assert.equal(hud.sleepMenu.style.display, "none", "…and the menu it left open is closed");

    // (9) SLICE 5's PHASE: the two panels arrive and the STACK DOES NOT MOVE.
    // Their openers are topbar chips beside the loc/clock/purse, not buttons in
    // the action column — the column is the thumb zone and it stays the verbs'.
    // The stack census above is the assertion that this is true; these are the
    // assertions that say WHERE they went instead.
    const openers = { Journal: hud.journalChip, Sheet: hud.sheetChip };
    for (const [name, chip] of Object.entries(openers)) {
      assert.ok(!hud.actions.children.includes(chip), `the ${name} opener is not in the action stack`);
      assert.ok(hud.topbar.children.includes(chip), `…it is a chip in the topbar`);
      // GLYPH-WIDTH DISCIPLINE (plan §2.8). The topbar has no width machinery —
      // centred flex, nowrap chips, unbounded location prose, no overflow
      // handling — so an opener that grew a word would be the thing that finally
      // wrapped it, and the location toast is pinned 42px under a SINGLE row.
      assert.equal(chip.tagName, "BUTTON", `the ${name} opener is a button, not a span: it has to be pressable`);
      assert.ok(chip.getAttribute("aria-label"), `…and it says what it is, because a glyph is not a label`);
      assert.equal([...String(chip.textContent)].length, 1, `…and it is ONE glyph wide (${chip.textContent})`);
      assert.ok(/white-space:nowrap/.test(chip.style.cssText), `…which nothing is allowed to break onto a second line`);
    }
    assert.ok(!/flex-wrap/.test(hud.topbar.style.cssText), "and the bar itself never wraps");
    assert.ok(/top:42px/.test(hud.locToastEl.style.cssText), "…which is what the location toast is pinned under");

    // AND THEY HAVE THEIR OWN DISPLAY TOGGLE, which is the whole reason they are
    // not free-riding on the topbar: the gate hides the bar, but DIALOGUE MODE
    // does not, and a journal opener over a conversation opens a panel the
    // player cannot walk out of.
    sim.mode = "walk";
    hud.update();
    assert.equal(hud.journalChip.style.display, "", "walking, the openers are up");
    sim.mode = "dialogue";
    hud.update();
    assert.equal(hud.topbar.style.display, "", "the topbar STAYS UP mid-conversation");
    assert.equal(hud.journalChip.style.display, "none", "…and the openers do not, which is what the toggle is for");
    assert.equal(hud.sheetChip.style.display, "none", "…both of them");
    sim.mode = "walk";
    hud.update();
  } finally {
    globalThis.setTimeout = realSetTimeout;
    globalThis.clearTimeout = realClearTimeout;
    loadedPF.save.gate = null;
    loadedPF.save.reset();
    loadedPF.spatial.reset();
  }
}

// ═══ THE TWO PANELS (0.12 slice 5) ══════════════════════════════════════════
// The journal and the character sheet, over the real Hud on the DOM shim. Two
// surfaces with two different memos, and the memo is the whole engineering: a
// panel that rebuilt every frame would write DOM sixty times a second, and one
// that built at open would go stale the moment anything under it moved.
{
  const P = loadedPF.player;
  const E = loadedPF.economy;
  const realSetTimeout = globalThis.setTimeout;
  const realClearTimeout = globalThis.clearTimeout;
  globalThis.setTimeout = () => 0;
  globalThis.clearTimeout = () => {};
  // The asset loader is touched by two paths below (`_rebuild` and
  // `onMainProps` both call load(), and a core with no packageId puts it in
  // "failed" for the session), so its state is restored rather than left where
  // these cases dropped it.
  const assetsWas = {
    status: loadedPF.assets.status,
    noPackage: loadedPF.assets._noPackage,
    failedAt: loadedPF.assets._failedAt,
    requestedTheme: loadedPF.assets._requestedTheme,
  };
  loadedPF.save.reset();
  loadedPF.spatial.reset();
  let mounts = 0;
  const mount = () => {
    const w = world.build(7, "cozy-village", null);
    const sim = new loadedPF.Sim(w);
    const core = {
      chatId: `chat-panels-${++mounts}`,
      sim,
      host: { chatMeta: {} },
      interact() {},
      setMode() {},
      resume() {},
      markDirty() {},
    };
    core.hud = new loadedPF.Hud(new FakeNode("div"), core);
    return { w, sim, core, hud: core.hud, player: P.get(core) };
  };
  /** Every sentence a panel actually put on screen, in the order it drew them. */
  const textOf = (node) =>
    walkNodes(node)
      .map((child) => String(child.textContent))
      .filter(Boolean);
  try {
    // ── THE JOURNAL IS ONE LIST, AND THE BAND IS NOT IN IT ────────────────────
    // Days newest first, lines inside a day in the order they were logged, and
    // the notice band OUTSIDE the grouping entirely — it reads a different array
    // and its rows answer to a told flag rather than to a day.
    {
      const at = mount();
      const hud = at.hud;
      assert.equal(hud.journalChip.style.display, "none", "the opener boots HIDDEN, before anything has decided");
      assert.equal(hud.journalEl.style.display, "none", "…and the panel behind it is not up either");

      at.player.ledger.lines.push(
        [2, "Walked to the mill."],
        [4, "Day 4: 12 things happened.", 12],
        [2, "Slept badly."],
        [5, "Fished the pond — 3 casts: carp x1."],
      );
      P.notice(at.player, "Something was set aside.", 3);
      P.notice(at.player, "Something came back.", 5);
      at.player.ledger.notices[0][2] = 1; // the older one has already been told

      hud.update();
      assert.equal(hud.journalChip.style.display, "", "walking, the opener is on screen");
      hud.toggleJournal();
      assert.equal(hud.journalEl.style.display, "flex", "and pressing it opens the panel");

      const shown = textOf(hud.journalBody);
      const where = (text) => shown.indexOf(text);
      // NEWEST DAY FIRST, from each line's OWN day and not from the array order
      // (day 2's lines were pushed first and last).
      assert.ok(where("Day 5") >= 0 && where("Day 4") >= 0 && where("Day 2") >= 0, `three days grouped (${shown})`);
      assert.ok(where("Day 5") < where("Day 4"), "day 5 is above day 4");
      assert.ok(where("Day 4") < where("Day 2"), "…and day 4 above day 2");
      assert.ok(where("Walked to the mill.") < where("Slept badly."), "inside a day, the order it was logged in");
      // A STUB RENDERS AS ITS STUB TEXT — the sentence the ledger holds is the
      // sentence the GM was given, and the panel does not tell a different story.
      assert.ok(where("Day 4: 12 things happened.") > where("Day 4"), "the stub renders as its own text, in its day");

      // THE BAND, and the structural claim about it: it reads `notices[]`, so
      // neither sentence in it is anywhere in `lines[]`.
      assert.ok(
        at.player.ledger.lines.every((line) => !/Something (was set aside|came back)/.test(line[1])),
        "the band's sentences are in NO ledger line — this is a second array, not a filtered one",
      );
      assert.ok(where("Day 5 — Something came back.") >= 0, "an UNTOLD notice is in the band");
      assert.ok(where("Day 3 — Something was set aside.") >= 0, "…and so is a TOLD one: the band is history");
      assert.ok(where("Day 5 — Something came back.") < where("Day 5"), "the band sits OUTSIDE the day grouping");
      assert.equal(where("Day 3"), -1, "…and a notice's own day mints no day group of its own");
    }

    // ── THE JOURNAL'S MEMO: TWO ARRAYS AND TWO LENGTHS ────────────────────────
    {
      const at = mount();
      const hud = at.hud;
      at.player.ledger.lines.push([3, "Bought a rod."]);
      hud.update();
      hud.toggleJournal();
      const drawn = hud.journalBody.children[0];
      hud.update();
      assert.equal(hud.journalBody.children[0], drawn, "an idle frame writes no DOM at all");

      // A REPLACEMENT. log() appends and then `_compactLedger` rebuilds the whole
      // array, so the identity half of the memo is what catches an ordinary line.
      const wasLines = at.player.ledger.lines;
      assert.equal(P.log(at.core, "Fished the pond.", 3), true, "a line is logged");
      assert.notEqual(at.player.ledger.lines, wasLines, "…and compaction handed back a NEW array");
      hud.update();
      assert.notEqual(hud.journalBody.children[0], drawn, "so the panel rebuilt");
      assert.ok(textOf(hud.journalBody).includes("Fished the pond."), "…with the new line in it");

      // AN APPEND THAT KEPT ITS ARRAY. notice() pushes onto the band and hands
      // the same array back while it is under the cap, so the LENGTH half of the
      // memo is the only thing that can see this one. (The FIRST notice mints the
      // band — a block with nothing to explain carries no `notices` key at all —
      // so the identity-preserving case is the second.)
      P.notice(at.player, "Something was set aside.", 2);
      hud.update();
      const rebuilt = hud.journalBody.children[0];
      const wasBand = at.player.ledger.notices;
      P.notice(at.player, "A third thing happened to the world.", 6);
      assert.equal(at.player.ledger.notices, wasBand, "the append kept the array it pushed onto");
      hud.update();
      assert.notEqual(hud.journalBody.children[0], rebuilt, "the length moved, so the panel rebuilt anyway");
      assert.ok(
        textOf(hud.journalBody).includes("Day 6 — A third thing happened to the world."),
        "…and the band has it",
      );

      // AND A REBUILD UNDER THE PANEL — a rewind, a swipe, a checkpoint load —
      // replaces `core.sim` wholesale, which replaces both arrays with rows read
      // back off the wire. The panel is looking at the OLD block until it is not.
      const holding = hud.journalBody.children[0];
      const row = JSON.parse(JSON.stringify(loadedPF.save.snapshot(at.core)));
      loadedPF.save._rebuild(at.core, row);
      assert.notEqual(at.core.sim, at.sim, "the rebuild really did replace the sim under the panel");
      assert.notEqual(P.get(at.core).ledger.lines, wasLines, "…and the arrays with it");
      hud.update();
      assert.notEqual(hud.journalBody.children[0], holding, "so the panel is drawn from the block that is live now");
    }

    // ── THE SHEET IS A LIVE VALUE KEY, NOT A SNAPSHOT ─────────────────────────
    // The player block carries no identity signal — every mutator mutates in
    // place — so the sheet watches VALUES. Each case below is one value that has
    // to be in the key, tested on its own, because a single "it re-renders" case
    // passes with most of the key deleted.
    {
      const at = mount();
      const hud = at.hud;
      hud.update();
      hud.toggleSheet();
      assert.equal(hud.sheetEl.style.display, "flex", "the sheet opens");
      assert.ok(textOf(hud.sheetStats).includes("Nothing practised yet"), "…on a player who has done nothing yet");

      const idle = hud.sheetStats.children[0];
      hud.update();
      assert.equal(hud.sheetStats.children[0], idle, "an idle frame writes no DOM");

      // XP PAID WHILE THE SHEET IS OPEN.
      P.award(at.core, { xp: 4, verb: "fishing" });
      hud.update();
      assert.notEqual(hud.sheetStats.children[0], idle, "an award under an open sheet re-renders it");
      const skills = textOf(hud.sheetStats);
      assert.ok(skills.includes("Fishing"), "the skill is named in this theme's own word for it");
      assert.ok(
        skills.includes(`Level 1 — ${P.xpPerLevel(1) - 4} xp to go`),
        `…with the level and what is left of it (${skills})`,
      );

      // A BARE HOSTILE FLIP: `d` does not move, `t` does not move, and the sheet
      // still has to say so. The rung counts alone would miss it entirely.
      P.bump(at.core, "village", "Rook", { t: 1 });
      hud.update();
      const known = hud.sheetStats.children[0];
      assert.ok(!textOf(hud.sheetStats).includes("Hostile"), "one acquaintance, nobody hostile");
      P.bump(at.core, "village", "Rook", { h: 1, t: 0 });
      assert.equal(P.get(at.core).rel.village.Rook.d, 0, "the ladder did not move");
      hud.update();
      assert.notEqual(hud.sheetStats.children[0], known, "the hostile flag re-rendered the sheet on its own");
      assert.ok(textOf(hud.sheetStats).includes("Hostile"), "…and the sheet flags them");

      // EQUIPMENT, by the pair's VALUES: the equip writes a fresh array, the
      // unequip `delete`s the slot, and both have to move the key. The rod is
      // granted and DRAWN first, on its own frame — otherwise the bag's count
      // moving would carry the equip's re-render and this case would pass with
      // the equipped pairs missing from the key entirely.
      P.grant(at.core, { t: "rod", k: "crude" }, 1);
      hud.update();
      const bare = hud.sheetStats.children[0];
      P.equip(at.core, "fishing", "tool", { t: "rod", k: "crude" });
      hud.update();
      assert.notEqual(hud.sheetStats.children[0], bare, "equipping re-renders");
      assert.ok(
        textOf(hud.sheetStats).includes(E.describe(at.w, { t: "rod", k: "crude" })),
        "…naming the rod the way every other surface names it",
      );
      assert.ok(textOf(hud.sheetStats).includes("Fishing rod"), "…under this theme's word for the slot");
      const held = hud.sheetStats.children[0];
      P.equip(at.core, "fishing", "tool", null);
      hud.update();
      assert.notEqual(hud.sheetStats.children[0], held, "and unequipping re-renders too — the `delete` path");
      assert.ok(textOf(hud.sheetStats).includes("Nothing to hand"), "…back to an empty rack");

      // THE PURSE AND WHAT IS CARRIED, both of which the key claims to project.
      const poor = hud.sheetStats.children[0];
      P.award(at.core, { money: 40 });
      hud.update();
      assert.notEqual(hud.sheetStats.children[0], poor, "money moving re-renders");
      assert.ok(textOf(hud.sheetStats).includes(E.money(at.w, 40)), "…in this world's own money");
      const light = hud.sheetStats.children[0];
      P.grant(at.core, { t: "catch-common", k: "carp" }, 2);
      hud.update();
      assert.notEqual(hud.sheetStats.children[0], light, "and so does the count in the bag");
      assert.ok(textOf(hud.sheetStats).includes("3 things"), "…which is the rod plus the two carp");

      // A CAPPED SKILL READS "MAX". award() zeroes `x` at the ceiling, so the
      // ordinary arithmetic would draw a bar that is empty and full at once.
      at.player.skills.verbs.fishing = { l: P.CAPS.skillLevel, x: 0 };
      hud.update();
      assert.ok(
        textOf(hud.sheetStats).includes(`Level ${P.CAPS.skillLevel} — MAX`),
        `a capped skill reads MAX (${textOf(hud.sheetStats)})`,
      );

      // THE PORTRAIT, and the pre-ready window the plan accepts: Tier-0 art is
      // drawn now and `assets.status` sits in the key, so the frame the authored
      // sheets arrive is the frame the portrait upgrades.
      const tier0 = hud.sheetArt.children[0];
      assert.equal(tier0.tagName, "CANVAS", "the portrait is a canvas, drawn rather than described");
      assert.ok(/image-rendering:pixelated/.test(tier0.style.cssText), "…as pixel art rather than a smeared one");
      assert.ok(/width:72px;height:96px/.test(tier0.style.cssText), "…integer-scaled: a 12×16 frame at 6×");
      assert.ok(textOf(hud.sheetArt).includes("Traveler"), "and the themed generic label is under it");
      loadedPF.assets.status = "ready";
      hud.update();
      assert.notEqual(hud.sheetArt.children[0], tier0, "the authored art arriving redraws the portrait");
      loadedPF.assets.status = assetsWas.status;
    }

    // ── AND THE THEME, WHICH IS FOUR OF THE SHEET'S ROWS AT ONCE ──────────────
    // The skill names, `describe()`'s prose, the money heading and the label
    // under the portrait all come out of the WORLD's word book, so a `_rebuild`
    // landing a different theme under an open sheet has moved what the sheet
    // draws without touching one player field. `assets.status` usually carries
    // this along — the loader is theme-aware and `_rebuild` calls it — but a
    // PARKED loader (no packageId, or inside the 30-second failed backoff)
    // returns before it can move `status`, and then the theme term is the only
    // thing left in the key that can see it.
    {
      const at = mount();
      loadedPF.assets._noPackage = true;
      loadedPF.assets.status = "failed";
      at.player.skills.verbs.fishing = { l: 2, x: 0 };
      at.hud.update();
      at.hud.toggleSheet();
      assert.ok(textOf(at.hud.sheetArt).includes("Traveler"), "the valley's sheet is open");
      assert.ok(textOf(at.hud.sheetStats).includes("Coin"), "…with the valley's heading over the purse");
      const valley = at.hud.sheetStats.children[0];
      const row = JSON.parse(JSON.stringify(loadedPF.save.snapshot(at.core)));
      row.theme = "sci-fi-colony";
      loadedPF.save._rebuild(at.core, row);
      assert.equal(at.core.sim.world.theme, "sci-fi-colony", "the rebuild landed the other theme");
      assert.equal(loadedPF.assets.status, "failed", "…and the parked loader never moved `status` on the way");
      at.hud.update();
      assert.notEqual(at.hud.sheetStats.children[0], valley, "the sheet re-rendered on the theme alone");
      assert.ok(textOf(at.hud.sheetArt).includes("Drifter"), "…saying who is standing there in this world's word");
      assert.ok(textOf(at.hud.sheetStats).includes("Angling"), "…over this world's word for the skill");
      assert.ok(textOf(at.hud.sheetStats).includes("Credit"), "…and this world's word for its money");
      loadedPF.assets._noPackage = assetsWas.noPackage;
      loadedPF.assets.status = assetsWas.status;
    }

    // ── THE WORD BOOK THE SHEET READS ─────────────────────────────────────────
    // Skills, slots and the player's own label are per THEME, like every other
    // name in the package. An unknown verb still renders rather than showing the
    // block's raw key.
    {
      assert.equal(E.playerLabel({ theme: "cozy-village" }), "Traveler", "a valley has travellers in it");
      assert.equal(E.playerLabel({ theme: "sci-fi-colony" }), "Drifter", "…and a colony has drifters");
      assert.equal(E.verbSkin({ theme: "cozy-village" }, "fishing").name, "Fishing");
      assert.equal(
        E.verbSkin({ theme: "sci-fi-colony" }, "fishing").name,
        "Angling",
        "the same verb, this world's word",
      );
      assert.equal(E.verbSkin({ theme: "sci-fi-colony" }, "fishing").tool, "rig", "…and its slots with it");
      assert.equal(
        E.verbSkin({ theme: "cozy-village" }, "flying-a-kite").name,
        "flying a kite",
        "a verb no theme names still renders, slug-derived — a newer build's row is a display fact, not a hole",
      );
      // …and the PANEL reads it rather than hardcoding the valley's words. Only
      // the word book is being exercised here, on a world whose theme was moved
      // under it.
      const at = mount();
      at.sim.world.theme = "sci-fi-colony";
      at.player.skills.verbs.fishing = { l: 2, x: 0 };
      at.hud.update();
      at.hud.toggleSheet();
      assert.ok(textOf(at.hud.sheetArt).includes("Drifter"), "the colony's sheet says Drifter");
      assert.ok(textOf(at.hud.sheetStats).includes("Angling"), "…over the colony's word for the skill");
    }
  } finally {
    globalThis.setTimeout = realSetTimeout;
    globalThis.clearTimeout = realClearTimeout;
    loadedPF.assets.status = assetsWas.status;
    loadedPF.assets._noPackage = assetsWas.noPackage;
    loadedPF.assets._failedAt = assetsWas.failedAt;
    loadedPF.assets._requestedTheme = assetsWas.requestedTheme;
    loadedPF.save.reset();
    loadedPF.spatial.reset();
  }
}

// ═══ THE PANELS' TWO KEYS, AND WHAT MAY NOT REACH THEM ══════════════════════
// The `C` hotkey and Escape live in the keydown handler BELOW its walk-mode
// bail (90-element), which is what makes every guard above that line theirs for
// free: the loading gate, focus inside a host control, a visible host modal.
// Pinned one guard at a time, because a single "the key is inert" case passes
// with three of them deleted.
//
// Drivable at all only because of the named shim extension further up: a
// settable `document.activeElement`, a staged `querySelectorAll`, and nodes that
// can have a size. Without those three this whole block is browser-only.
{
  const core = loadedPF.core;
  const realSetTimeout = globalThis.setTimeout;
  const realClearTimeout = globalThis.clearTimeout;
  const realWindow = globalThis.window;
  globalThis.setTimeout = () => 0;
  globalThis.clearTimeout = () => {};
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  const assetsWas = {
    status: loadedPF.assets.status,
    noPackage: loadedPF.assets._noPackage,
    failedAt: loadedPF.assets._failedAt,
  };
  loadedPF.save.reset();
  try {
    const w = world.build(7, "cozy-village", null);
    const sim = new loadedPF.Sim(w);
    core.chatId = "chat-panel-keys";
    core.sim = sim;
    core.host = { chatId: "chat-panel-keys", chatMeta: {} };
    core._narrationDoneWas = true;
    core._talkConfirm = null;
    // The Hud mounts INTO the element the core calls its own, which is what
    // makes "focus is inside our own surface" a real question below.
    const mountEl = new FakeNode("div");
    core._mainEl = mountEl;
    const hud = new loadedPF.Hud(mountEl, core);
    core.hud = hud;
    core._keysBound = false;
    core._bindKeys();
    const press = (key, target) => core._keyDown({ key, target: target ?? null, preventDefault() {} });
    hud.update();

    // ── THE ORDINARY PRESS: `c` toggles, and Escape closes what is open ───────
    press("c");
    assert.equal(hud._sheet, true, "`c` opens the sheet");
    assert.equal(hud.sheetEl.style.display, "flex", "…and puts it on screen");
    press("c");
    assert.equal(hud._sheet, false, "…and `c` again closes it: it toggles");
    press("c");
    assert.equal(hud._sheet, true, "open again");
    press("escape");
    assert.equal(hud._sheet, false, "Escape closes it");
    assert.equal(hud.closePanels(), false, "…and with nothing open, Escape closes nothing and says so");

    // AND OUR OWN PANELS ARE NOT MODAL DIALOGS, which is a trap and not a
    // detail: `_hostOwnsKeyboard` believes any visible
    // `[role="dialog"][aria-modal="true"]`, so a panel that marked itself one
    // would make the very keys that close it inert the moment it opened.
    for (const panel of [hud.sheetEl, hud.journalEl]) {
      assert.equal(panel.getAttribute("aria-modal"), null, "a panel of ours is not an aria-modal dialog");
      assert.equal(panel.getAttribute("role"), null, "…and claims no dialog role either");
    }

    // ── (1) THE LOADING GATE ──────────────────────────────────────────────────
    loadedPF.save.gate = { chatId: core.chatId, state: "generating" };
    press("c");
    assert.equal(hud._sheet, false, "a world still being written has nobody to be a sheet about");
    loadedPF.save.gate = null;

    // ── (2) FOCUS INSIDE A HOST CONTROL ───────────────────────────────────────
    const hostInput = new FakeNode("input");
    document.activeElement = hostInput;
    press("c");
    assert.equal(hud._sheet, false, "a player typing into the host's own box is not pressing our hotkey");
    // …and focus inside OUR surface is not the host owning anything. This is the
    // half a broader guard gets wrong: the player has just clicked our own chip.
    document.activeElement = hud.sheetChip;
    press("c");
    assert.equal(hud._sheet, true, "focus on our own chip is still our keyboard");
    press("escape");
    document.activeElement = null;

    // ── (3) A VISIBLE HOST MODAL ──────────────────────────────────────────────
    const modal = new FakeNode("div");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal._rect = { width: 320, height: 200 };
    document._staged = [modal];
    press("c");
    assert.equal(hud._sheet, false, "the setup wizard is open over us; `c` belongs to it");
    // …and the MEASUREMENT is load-bearing, not the selector: the toast
    // container is a permanently-mounted zero-size panel, and a guard that
    // believed every match would make the hotkey dead for the whole session.
    modal._rect = { width: 0, height: 0 };
    press("c");
    assert.equal(hud._sheet, true, "a modal with no size on screen is not a modal in the way");
    press("escape");
    // …and a staged node that is a dialog but NOT aria-modal is not a match at
    // all, which is the selector's own half.
    const bare = new FakeNode("div");
    bare.setAttribute("role", "dialog");
    bare._rect = { width: 320, height: 200 };
    document._staged = [bare];
    press("c");
    assert.equal(hud._sheet, true, "a non-modal dialog does not take the keyboard");
    press("escape");
    document._staged = [];

    // ── (4) THE WRONG MODE ────────────────────────────────────────────────────
    sim.mode = "dialogue";
    press("c");
    assert.equal(hud._sheet, false, "there is no sheet to open mid-conversation");
    sim.mode = "walk";
    hud.update();

    // ── CLOSE-ON-MODE-CHANGE, DRIVEN BY THE PROPS ─────────────────────────────
    // Replay and combat arrive through onMainProps, not through anything the
    // player pressed — so the sheet has to close under a mode change nobody in
    // this package asked for. CLOSED and not hidden: a hidden one resurfaces
    // drawn against whoever the player was before.
    press("c");
    assert.equal(hud._sheet, true, "the sheet is open when the host takes the screen");
    const drawn = hud.sheetStats.children[0];
    core.onMainProps({ chatId: core.chatId, replayActive: true, chatMeta: {} });
    assert.equal(sim.mode, "replay", "the props moved the mode");
    assert.equal(hud._sheet, false, "…and the sheet CLOSED");
    assert.equal(hud.sheetEl.style.display, "none", "…off the screen with it");
    assert.equal(hud._sheetKey, null, "…and its memo went too, so nothing stale can be resurfaced");
    core.onMainProps({ chatId: core.chatId, replayActive: false, chatMeta: {} });
    assert.equal(sim.mode, "walk", "the screen comes back");
    press("c");
    assert.notEqual(hud.sheetStats.children[0], drawn, "and reopening REBUILDS rather than resurfacing");

    // THE JOURNAL ONLY HIDES, which is the deliberate difference: it is a list of
    // what is written down, with no live descriptor to go stale, and a passing
    // combat state should not throw the player's place in it away.
    hud.closePanels();
    hud.toggleJournal();
    const listed = hud.journalBody.children[0];
    assert.equal(hud._journal, true, "the journal is open");
    core.onMainProps({ chatId: core.chatId, replayActive: true, chatMeta: {} });
    assert.equal(hud._journal, true, "…and stays open through a replay");
    assert.equal(hud.journalEl.style.display, "none", "…while being off the screen for it");
    core.onMainProps({ chatId: core.chatId, replayActive: false, chatMeta: {} });
    assert.equal(hud.journalEl.style.display, "flex", "and walking again brings it straight back");
    assert.equal(hud.journalBody.children[0], listed, "…the same list, not a rebuilt one");
    hud.closePanels();
  } finally {
    core._unbindKeys();
    globalThis.setTimeout = realSetTimeout;
    globalThis.clearTimeout = realClearTimeout;
    if (realWindow === undefined) delete globalThis.window;
    else globalThis.window = realWindow;
    document.activeElement = null;
    document._staged = [];
    loadedPF.assets.status = assetsWas.status;
    loadedPF.assets._noPackage = assetsWas.noPackage;
    loadedPF.assets._failedAt = assetsWas.failedAt;
    loadedPF.save.gate = null;
    core.chatId = null;
    core.sim = null;
    core.hud = null;
    core.host = null;
    core._mainEl = null;
    loadedPF.save.reset();
  }
}

// ── TALK NEVER SILENTLY SPENDS NARRATION THE PLAYER HAS NOT READ ──────────────
// Second live playtest: the maintainer wandered off mid-narration, pressed E on
// Rook, and lost everything from the arrival narration onward. The turn Talk
// sends ENDS the one being presented, so the segments they had not reached
// simply never appeared — they survived only in Logs — and nothing ever asked
// them whether to skip.
//
// Walking is not blocked and never should be. What is gated is the TURN: while
// the latest GM turn still holds unshown narration, the first press turns the
// button into the question and sends nothing.
{
  // 90-element is a DOM module the bundle at the top of this file leaves out;
  // case 14m already evaluates it on its own against the two globals it touches
  // at load, so `loadedPF.core` is here by the time this runs. Nothing below
  // drives the custom element or the raf loop.
  const core = loadedPF.core;
  assert.ok(core && typeof core.interact === "function", "the core is loaded, with its interaction on it");

  const realSetTimeout = globalThis.setTimeout;
  const realClearTimeout = globalThis.clearTimeout;
  globalThis.setTimeout = () => 0;
  globalThis.clearTimeout = () => {};
  loadedPF.save.reset();
  try {
    const w = world.build(9001, "cozy-village");
    const sim = new loadedPF.Sim(w);
    const sent = [];
    const toasts = [];
    core.chatId = "chat-talk-skip";
    core.sim = sim;
    core.hud = { toast: (text) => toasts.push(text), refreshChips() {}, update() {} };
    const host = {
      chatId: "chat-talk-skip",
      isStreaming: false,
      sendMessage: (text) => {
        sent.push(text);
        return true;
      },
      narrationDone: false,
      latestAssistant: { id: "m1" },
    };
    core.host = host;
    const villagers = w.zones.village.npcs;
    const talkTo = (npc) => {
      sim.mode = "walk";
      sim.nearNpc = npc;
      core.interact();
    };
    const settle = async () => {
      for (let i = 0; i < 8; i++) await Promise.resolve();
    };

    // THE REPORTED PRESS: story still to read, so it asks.
    talkTo(villagers[0]);
    await settle();
    assert.deepEqual(sent, [], "the first press sends nothing while there is narration to read");
    assert.equal(core.talkConfirmArmed(), true, "…it arms the question on the button instead");
    assert.ok(
      toasts.some((text) => /press again/i.test(text)),
      "…and says so out loud",
    );
    assert.equal(sim.mode, "walk", "…and does not hand the keyboard away either");

    // AND THE SECOND PRESS IS THE AFFIRMATIVE ONE.
    talkTo(villagers[0]);
    await settle();
    assert.equal(sent.length, 1, "the second press sends, exactly once");
    assert.ok(sent[0].includes(villagers[0].name), "…to the person standing there");
    assert.equal(core.talkConfirmArmed(), false, "and the question is spent with it");
    assert.equal(sim.mode, "dialogue", "…the turn having been taken");

    // NO REGRESSION FOR THE ORDINARY PRESS: nothing unread, one press, one turn.
    sent.length = 0;
    host.narrationDone = true;
    talkTo(villagers[0]);
    await settle();
    assert.equal(sent.length, 1, "with the narration read, Talk still sends on the first press");

    // AND A CHAT WITH NO GM TURN IN IT HAS NO STORY TO LOSE. `narrationDone` is
    // false there too — the host has no message to compare its marker against —
    // so without the second half of the test every greeting in a fresh chat
    // would need two presses.
    sent.length = 0;
    host.narrationDone = false;
    host.latestAssistant = null;
    talkTo(villagers[0]);
    await settle();
    assert.equal(sent.length, 1, "an empty chat skips nothing, so it asks nothing");

    // THE QUESTION IS PER-PERSON, and it goes stale rather than carrying.
    sent.length = 0;
    host.latestAssistant = { id: "m2" };
    talkTo(villagers[0]);
    await settle();
    assert.equal(core.talkConfirmArmed(), true, "armed for the person you are standing at");
    sim.nearNpc = villagers[1];
    assert.equal(core.talkConfirmArmed(), false, "…and not for the next person you walk up to");
    talkTo(villagers[1]);
    await settle();
    assert.deepEqual(sent, [], "who is asked in their own right");

    // NARRATION FINISHING DROPS IT WITHOUT A PRESS: the question was only ever
    // about story that was still pending.
    assert.equal(core.talkConfirmArmed(), true, "the question stands while the narration does");
    host.narrationDone = true;
    assert.equal(core.talkConfirmArmed(), false, "…and is gone the moment there is nothing left to read");

    // WHAT THE MAINTAINER ACTUALLY SEES: the button carries the question.
    host.narrationDone = false;
    const hud = new loadedPF.Hud(new FakeNode("div"), core);
    core.hud = hud;
    sim.mode = "walk";
    sim.nearNpc = villagers[1];
    core._talkConfirm = null;
    hud.update();
    assert.equal(hud.talkBtn.textContent, `Talk to ${villagers[1].name} (E)`, "unarmed, it is the ordinary Talk");
    core.interact();
    await settle();
    hud.update();
    assert.equal(hud.talkBtn.textContent, "Skip story & talk?", "armed, the button IS the confirm");
    host.narrationDone = true;
    hud.update();
    assert.equal(hud.talkBtn.textContent, `Talk to ${villagers[1].name} (E)`, "and it goes back on its own");

    // THE TURN IS HALF THE QUESTION, NOT JUST THE PERSON (round-2 review).
    // `narrationDone` is PER-TURN and goes false again for every new GM turn, so
    // "there is still story to read" is not the same fact from one turn to the
    // next. The player can arm the confirm, type into the host's own message box
    // instead of pressing again, and have a NEW turn land unread — and a confirm
    // that remembered only the NPC would let ONE press spend the new narration on
    // the permission they gave for the old one, which is the exact loss the
    // confirm exists to prevent.
    sent.length = 0;
    core._talkConfirm = null;
    host.narrationDone = false;
    host.latestAssistant = { id: "m3" };
    talkTo(villagers[1]);
    await settle();
    assert.equal(core.talkConfirmArmed(), true, "armed against the turn that was on screen when it was asked");
    host.latestAssistant = { id: "m4" }; // a new GM turn, unread in its own right
    host.narrationDone = false;
    assert.equal(core.talkConfirmArmed(), false, "…and not against the turn that replaced it");
    talkTo(villagers[1]);
    await settle();
    assert.deepEqual(sent, [], "one press does not spend the new narration on the old permission");
    assert.equal(core.talkConfirmArmed(), true, "…that press being the question again, asked about this turn");

    // AND A MODE CHANGE DROPS IT. The question is asked in walk mode standing
    // next to somebody, and every way out of that frame — the Keyboard button
    // handing the turn back to the host, a cutscene beat, combat — is the player
    // doing something other than what the question was about. Named as a clear
    // condition when the confirm shipped; pinned here.
    sent.length = 0;
    assert.equal(core.talkConfirmArmed(), true, "armed before the mode changes under it");
    core.setMode("dialogue"); // the Keyboard button
    core.setMode("walk"); // Resume walking
    sim.nearNpc = villagers[1];
    assert.equal(core.talkConfirmArmed(), false, "the question does not survive the mode changing under it");
    talkTo(villagers[1]);
    await settle();
    assert.deepEqual(sent, [], "…so walking back into it asks again rather than sending");
  } finally {
    globalThis.setTimeout = realSetTimeout;
    globalThis.clearTimeout = realClearTimeout;
    core.chatId = null;
    core.sim = null;
    core.hud = null;
    core.host = null;
    core._talkConfirm = null;
    loadedPF.save.reset();
  }
}

// The other location-entry notice — a narrated drift the package follows — is the
// same class of message and shared the same collision.
{
  const prevGetSpatial = loadedPF.api.getSpatial;
  const state = { loc: "root" };
  loadedPF.api.getSpatial = async () => ({
    definition: { revision: 1 },
    currentLocationId: state.loc,
    breadcrumb: [{ name: state.loc }],
    destinations: [],
  });
  const toasts = [];
  const core = {
    chatId: "chat-loc-toast",
    sim: {
      world: { zones: {}, bindings: { seeded: true }, startZone: "z1" },
      zoneId: "z1",
      mode: "walk",
      zone: () => ({ name: "z1" }),
    },
    markDirty() {},
    hud: { toast: (text, kind) => toasts.push([text, kind]), refreshChips() {} },
  };
  try {
    loadedPF.spatial.reset();
    await loadedPF.spatial.refresh(core); // seeds _lastLocationId
    state.loc = "the-slag-bar";
    await loadedPF.spatial.refresh(core);
    const arrival = toasts.find(([text]) => text.startsWith("Now at:"));
    assert.ok(arrival, "the drift is announced");
    assert.equal(arrival[1], "location", "…as a location notice, so it lands on the top surface");
  } finally {
    loadedPF.api.getSpatial = prevGetSpatial;
    loadedPF.spatial.reset();
  }
}

// ── THE WIZARD'S OWN TWO FACTS ────────────────────────────────────────────────
// (i) the launch label was the literal "Begin in Hearthvale", rewritten only on
// the RETRY path, so a sci-fi colony called Meridian Base offered to begin in a
// cozy village that was not in the game; (ii) `generate: true` was unconditional,
// which retired the skip affordance — the themed-default immediate-play path (no
// gate, no purse) became unreachable for every new chat, and the {skipped:true}
// marker had readers and no writer.
{
  const realGetJson = loadedPF.api.getJson;
  loadedPF.api.getJson = async (path) =>
    path === "/connections" ? [{ id: "conn-1", name: "Main", isDefault: true }] : [];
  const settle = async () => {
    for (let i = 0; i < 16; i++) await Promise.resolve();
  };
  const mountWizard = async () => {
    const el = new FakeNode("div");
    const launches = [];
    loadedPF.mountSetup(el, { onLaunch: async (config, name) => void launches.push({ config, name }) });
    await settle(); // the connections/characters load is an async IIFE
    const nodes = walkNodes(el);
    const checkboxes = nodes.filter((node) => node.type === "checkbox");
    assert.equal(checkboxes.length, 1, "with no characters to pick, the only checkbox is the generation toggle");
    return {
      launches,
      nameIn: nodes.find((node) => node.tagName === "INPUT" && node.value === "Hearthvale"),
      themeSel: nodes.find((node) => node.children.some((option) => option.attrs.value === "sci-fi-colony")),
      launchBtn: nodes.find((node) => node.tagName === "BUTTON" && String(node.textContent).startsWith("Begin in")),
      generateIn: checkboxes[0],
    };
  };
  try {
    const asked = await mountWizard();
    assert.ok(asked.nameIn && asked.themeSel && asked.launchBtn, "the wizard mounted its name, theme and launch");
    assert.equal(asked.launchBtn.textContent, "Begin in Hearthvale", "the label starts at the active preset's name");
    asked.themeSel.value = "sci-fi-colony";
    await fire(asked.themeSel, "change");
    assert.equal(asked.launchBtn.textContent, "Begin in Meridian Base", "a theme change carries it");
    asked.nameIn.value = "Anchorage Nine";
    await fire(asked.nameIn, "input");
    assert.equal(asked.launchBtn.textContent, "Begin in Anchorage Nine", "and the player's own name wins over both");

    assert.equal(asked.generateIn.checked, true, "generation is offered checked — it is what the package is for");
    await fire(asked.launchBtn, "click");
    assert.equal(asked.launches.length, 1, "the launch went through");
    assert.equal(asked.launches[0].name, "Anchorage Nine", "under the name on the button");
    assert.equal(asked.launches[0].config.experienceConfig.generate, true, "asking for a generated world");

    const declined = await mountWizard();
    declined.generateIn.checked = false;
    await fire(declined.launchBtn, "click");
    assert.equal(declined.launches[0].config.experienceConfig.generate, false, "unchecked declines the call");
    assert.ok(
      Number.isInteger(declined.launches[0].config.experienceConfig.seed),
      "…and still carries the seed and theme the themed default world compiles from",
    );

    // One layer down, with the config the wizard really wrote: the gate reads it,
    // so a declined world is a chat that never waits for a call it did not make.
    loadedPF.save.reset();
    assert.equal(
      loadedPF.save.armGate({ chatId: "chat-declined" }, { gameSetupConfig: declined.launches[0].config }),
      false,
      "no gate arms for a declined world",
    );
    assert.equal(
      loadedPF.save.armGate({ chatId: "chat-asked" }, { gameSetupConfig: asked.launches[0].config }),
      true,
      "…and one does for a world that asked",
    );
  } finally {
    loadedPF.api.getJson = realGetJson;
    loadedPF.save.reset();
  }
}

console.log("brief validator + compiler: all cases passed");
