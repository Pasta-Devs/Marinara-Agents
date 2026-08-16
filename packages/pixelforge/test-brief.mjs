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
const source = ["00-prelude.js", "10-art.js", "15-assets.js", "18-brief.js", "20-world.js", "30-sim.js", "50-spatial.js", "55-maps-export.js"]
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
      scale: "village", name: "Mossbrook", backgroundPopulation: 30,
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
  assert.ok(sealed._repairs.some((r) => r.includes("bucketed")), "repair logged");
}

// 3. Degenerate-but-valid: one household, one zone, all-grey tints, tiny cast.
{
  const sealed = brief.validate(
    {
      scale: "hamlet", name: "Greyfold",
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
      scale: "village", name: "**Objton**",
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
  assert.equal(sealed.cast[0].household, 6, "household clamped to cap");
  assert.equal(sealed.cast[1].home, "Objton", "unresolved home falls to root");
  assert.equal(sealed.cast[2].kind, "folk", "unknown kind folds to folk");
  assert.ok(Object.keys(brief.TINTS).includes(sealed.cast[2].tint), "unknown tint replaced from the enum");
  assert.equal(sealed.cast[3].home, "Objton", "folded home resolution (case)");
}

// 5. Caps: too many places, duplicate names, unknown feature tags drop whole items.
{
  const sealed = brief.validate(
    {
      scale: "town", name: "Capston",
      features: [
        { tag: "crop-plots", name: "Plots" },
        { tag: "not-a-tag", name: "Ghost" },
        { tag: "dense-growth", name: "WrongZone" }, // wilds-only tag in the settlement
      ],
      places: [
        { kind: "wilds", name: "Wood" }, { kind: "wilds", name: "Wood" }, { kind: "wilds", name: "Wood3" },
        { kind: "hall", name: "Hall A" }, { kind: "hall", name: "Hall B" }, { kind: "gathering", name: "Inn" },
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
  assert.equal(sealed.places.filter((p) => p.kind === "wilds").length, 2, "wilds capped at 2");
  assert.equal(sealed.places.filter((p) => p.kind === "hall").length, 1, "hall capped at 1");
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
  assert.ok(variants.some((v) => v !== a), "top-ups derive from the seed");
}

// 7. Defaults: both themes produce valid sealed briefs with the known casts.
{
  for (const theme of ["cozy-village", "sci-fi-colony"]) {
    const sealed = brief.defaults(theme, 424242);
    assert.equal(sealed.theme, theme);
    assert.ok(sealed.cast.length >= 4);
    assert.ok(sealed.places.some((p) => p.kind === "gathering"), `${theme} default has a gathering place`);
    assert.ok(JSON.stringify(sealed).length <= 8_192, "default brief inside the byte budget");
  }
}

// 8. Non-Latin names survive: caps are grapheme-based, folding resolves homes, ids carry identity.
{
  const sealed = brief.validate(
    {
      scale: "village", name: "囲炉裏の村",
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
  assert.ok(text.includes("do NOT list one household per person"), "household teaching line present");
  assert.ok(JSON.stringify(brief.schema()).length <= 8_000, "schema fits the route's cap");
}

// ── Compiler invariants (compile(sealedBrief, seed)) ─────────────────────────
function checkWorld(w, sealed, label) {
  assert.equal(w.startZone, "z1", `${label}: settlement is z1`);
  assert.ok(w.zones.z1, `${label}: z1 exists`);
  // Every named zone in the brief exists under its ordinal id.
  for (const [id, name] of Object.entries(sealed._ids.zones)) {
    assert.ok(w.zones[id], `${label}: zone ${id} (${name}) compiled`);
    assert.equal(w.zones[id].name, name, `${label}: ${id} keeps its display name`);
  }
  // Every cast member is placed in a real zone, with a legal wander rect.
  const placed = Object.values(w.zones).flatMap((z) => z.npcs.map((n) => n.name));
  for (const member of sealed.cast) assert.ok(placed.includes(member.name), `${label}: ${member.name} placed`);
  for (const zone of Object.values(w.zones)) {
    for (const npc of zone.npcs) {
      assert.ok(npc.wander.x0 >= 0 && npc.wander.x1 < zone.w && npc.wander.y0 >= 0 && npc.wander.y1 < zone.h,
        `${label}: ${npc.name} wander inside ${zone.id}`);
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
  // Buildings honor the arithmetic (§4.5): at least one roof per distinct
  // household homed at the settlement root. (Household MERGING only kicks in
  // under area pressure, which no harness fixture reaches — a future stress
  // fixture that trips this assert should relax it to the merged-block count.)
  const v = w.zones.z1;
  const rootName = sealed._ids.zones.z1;
  const rootHouseholds = new Set(sealed.cast.filter((c) => c.home === rootName).map((c) => c.household));
  const doorCount = v.object.filter((t) => t === "door").length;
  assert.ok(
    doorCount >= rootHouseholds.size,
    `${label}: a roof per settlement household (${doorCount} doors < ${rootHouseholds.size} households)`,
  );
  assert.ok(!v.solid[v.w * v.spawn.y + v.spawn.x], `${label}: spawn walkable`);
}

// 10. Both themed default briefs compile with all invariants holding.
for (const theme of ["cozy-village", "sci-fi-colony"]) {
  const sealed = brief.defaults(theme, 424242);
  checkWorld(world.build(424242, theme, sealed), sealed, `defaults(${theme})`);
}

// 11. The farm-village case compiles: four households → four-ish roofs, never thirty.
{
  const sealed = brief.validate(
    {
      scale: "village", name: "Mossbrook", backgroundPopulation: 30,
      places: [{ kind: "hall", name: "The Grange Hall" }, { kind: "gathering", name: "The Wet Boot" }],
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
  assert.ok(doorCount >= 4 && doorCount <= 10, `a handful of doors (${doorCount}), never thirty`);
  assert.ok(w.zones.z2 && w.zones.z3, "hall and gathering interiors compiled");
  // The only fixture that proves home-to-zone binding for a NON-root home:
  // resolve the gathering's ordinal id and assert membership in THAT zone.
  const gatheringId = Object.entries(sealed._ids.zones).find(([, zoneName]) => zoneName === "The Wet Boot")?.[0];
  assert.ok(gatheringId, "the gathering has an ordinal id");
  const innkeeper = w.zones[gatheringId].npcs.find((n) => n.name === "Perrin");
  assert.ok(innkeeper, "the innkeeper lives in the gathering interior");
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
      scale: "village", name: "Meterton",
      flavor: "Dust and patience.",
      situation: "Foreman Vex is hiding the cracked dome report from surveyor Yun.",
      places: [{ kind: "gathering", name: "The Bar", flavor: "Low lights, long tabs." }],
      cast: [
        { name: "Vex", role: "foreman", kind: "leader", tint: "red", home: "Meterton", household: 1, persona: "Wants quota; hiding the report." },
        { name: "Yun", role: "surveyor", kind: "scholar", tint: "teal", home: "Meterton", household: 2, persona: "Wants truth; hiding the source." },
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
    world: w, zoneId: "z1", nearNpc: null, dirty: false,
    zone() { return this.world.zones[this.zoneId]; },
    clockLabel: () => "Day 1 · 08:00",
  };
  // Borrow the real methods off the shipped Sim prototype.
  sim.header = loadedPF.Sim.prototype.header.bind(sim);
  sim.composePrefix = loadedPF.Sim.prototype.composePrefix.bind(sim);
  sim.commitIntro = loadedPF.Sim.prototype.commitIntro.bind(sim);
  const npcVex = Object.values(w.zones).flatMap((z) => z.npcs).find((n) => n.name === "Vex");
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
  assert.ok(truncated.cast.every((c) => !("ki" in c)), "the partial trailing field is dropped");
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
  assert.ok(sealed.cast.some((c) => c.name === "Mayor Last" && c.kind === "leader"), "the leader is hoisted into the kept set");
}

// 17. Host synthesis: a host with no gathering place gets an interior to keep.
{
  const sealed = brief.validate(
    {
      scale: "village", name: "Hostville",
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
      scale: "village", name: "Sameton",
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
      scale: "village", name: "Twinwood",
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
  const wildsIds = Object.values(w.zones).filter((z) => sealed.places.some((p, i) => p.kind === "wilds" && `z${i + 2}` === z.id)).map((z) => z.id);
  assert.equal(wildsIds.length, 2, "both wilds compiled");
  for (const id of wildsIds) {
    assert.ok(w.zones.z1.portals.some((p) => p.toZone === id), `settlement has a portal to ${id}`);
    assert.ok(w.zones[id].portals.some((p) => p.toZone === "z1"), `${id} leads back to the settlement`);
  }
}

// 21. Review blocker regression: the spatial seed binding uses the world's OWN
// start zone (compiled worlds key z1..), and a stale binding degrades safely.
{
  const sealed = brief.defaults("cozy-village", 99);
  const w = world.build(99, "cozy-village", sealed);
  const sim = {
    world: w, zoneId: w.startZone, mode: "walk",
    zone() { return this.world.zones[this.zoneId]; },
    teleport(zoneId) { this.zoneId = zoneId; },
  };
  let dirtied = false;
  const core = { chatId: "chat-spatial", sim, markDirty: () => { dirtied = true; }, hud: { toast() {}, refreshChips() {} } };
  loadedPF.api = loadedPF.api ?? {};
  const prevGetSpatial = loadedPF.api.getSpatial;
  loadedPF.api.getSpatial = async () => ({
    definition: { revision: 1 }, currentLocationId: "loc-root",
    breadcrumb: [{ name: "Rootville" }], destinations: [],
  });
  loadedPF.spatial.reset();
  await loadedPF.spatial.refresh(core);
  assert.equal(w.bindings["loc-root"], "z1", "first-seen location binds the compiled start zone, never a legacy literal");
  assert.equal(w.zones.z1.spatialLocationId, "loc-root", "the zone records its location id");
  assert.ok(dirtied, "the seeded binding persists via a save");
  // Narrated drift onto a STALE binding (zone gone) must not throw or teleport.
  w.bindings["loc-ghost"] = "no-such-zone";
  loadedPF.api.getSpatial = async () => ({
    definition: { revision: 1 }, currentLocationId: "loc-ghost",
    breadcrumb: [{ name: "Ghost" }], destinations: [],
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
  assert.ok(salvagedSeal._repairs.some((r) => r.includes("salvaged")), "salvage recorded in _repairs");

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
  const busySeal = await brief.generate("c", { theme: "cozy-village", seed: 3, preferences: "x".repeat(9000), busyWaitMs: 0 });
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
    for (let i = 0; i < 40 && !(loadedPF.assets.status === "ready" && loadedPF.assets._requestedTheme === "sci-fi-colony"); i++) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    assert.equal(loadedPF.assets.status, "ready", "chase load settles");
    assert.equal(loadedPF.assets.atlasTheme, "sci-fi-colony", "the mid-load theme change is chased, not dropped");
    assert.ok(requested.some((u) => u.includes("tiles-sci-fi-colony.png")), "the themed atlas sheet was requested");
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
    sim: { world: { zones: {}, bindings: { seeded: true }, startZone: "z1" }, zoneId: "z1", mode: "walk", zone() { return { name: "z1" }; } },
    markDirty() {},
    hud: { toast: (t) => toasts.push(t), refreshChips() {} },
  };
  const spatial = loadedPF.spatial;
  spatial.reset();
  await spatial.refresh(core); // seed availability + _lastLocationId ("root")

  // 28. committed with a matching commandId resolves the journey instantly.
  spatial.pending = { commandId: "cmd-1", destinationId: "bar", name: "Bar", staleCount: 0 };
  spatialState.loc = "bar";
  spatial.onHostEvent(core, { type: "spatial_transition_committed", chatId: core.chatId, data: { commandId: "cmd-1" } });
  assert.equal(spatial.pending, null, "committed event clears the pending journey");
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(spatial._lastLocationId, "bar", "the event-driven refresh applied the new location");

  // 29. stepwise journeys survive intermediate hops; the completing event ends them.
  spatial.pending = { commandId: "cmd-2", destinationId: "far", name: "Far", staleCount: 0 };
  spatial.onHostEvent(core, {
    type: "spatial_transition_committed", chatId: core.chatId,
    data: { commandId: "cmd-2", travel: { mode: "step_by_step", complete: false } },
  });
  assert.ok(spatial.pending && spatial.pending.stepwise, "incomplete stepwise leg keeps (and marks) the pending journey");
  spatialState.loc = "midway";
  await spatial.refresh(core);
  assert.ok(spatial.pending, "an intermediate hop is progress, not supersession");
  spatial.onHostEvent(core, {
    type: "spatial_transition_committed", chatId: core.chatId,
    data: { commandId: "cmd-2", travel: { mode: "step_by_step", complete: true } },
  });
  assert.equal(spatial.pending, null, "the completing event ends the stepwise journey");

  // Rejected event: instant clear + toast; stale-count untouched by event refreshes.
  spatial.pending = { commandId: "cmd-3", destinationId: "nope", name: "Nope", staleCount: 0 };
  spatial.onHostEvent(core, { type: "spatial_transition_rejected", chatId: core.chatId, data: { commandId: "cmd-3", code: "spatial_transition_stale_definition" } });
  assert.equal(spatial.pending, null, "rejected event clears the journey immediately");
  assert.ok(toasts.some((t) => t.includes("stayed put")), "rejection toasts immediately");

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
        type: "spatial_transition_rejected", chatId: core.chatId,
        data: { commandId: spatial.pending.commandId, code: "spatial_transition_stale_definition" },
      });
      return false;
    },
  };
  core.host = host;
  core.sim.composePrefix = () => "[World]";
  core.sim.commitIntro = () => {};
  await spatial.travel(core, { id: "bar", name: "Bar" });
  assert.ok(toasts.some((t) => t.includes("stayed put")), "the event toast fired");
  assert.ok(!toasts.some((t) => t.includes("isn't accepting")), "no contradictory second toast after the event handled it");

  loadedPF.api.getSpatial = prevGetSpatial;
  spatial.reset();
}

// 31-36. World Maps export (spec §8): seed-stable ids, the definition as the
// idempotency ledger, additive-route retry discipline, and quiet degradation.
{
  const exportScaffold = (seed, chatId) => {
    const sealed = brief.defaults("cozy-village", seed);
    const w = world.build(seed, "cozy-village", sealed);
    const sim = {
      world: w, zoneId: w.startZone, mode: "walk",
      zone() { return this.world.zones[this.zoneId]; },
      teleport() {},
    };
    const core = { chatId, sim, dirty: 0, hud: { toast() {}, refreshChips() {} } };
    core.markDirty = () => { core.dirty++; };
    return { w, core };
  };
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
    const zoneIds = Object.keys(w.zones).filter((id) => id !== w.startZone);
    assert.ok(zoneIds.length >= 2, "the default brief compiles interior and wilds zones");
    const preSeeded = mapsExport.idFor(w, zoneIds[0]);
    let revision = 5;
    let serverLocs = [{ id: "loc-root", kind: "settlement" }, { id: preSeeded, kind: "building" }];
    const posts = [];
    loadedPF.api.getSpatial = async () => ({
      definition: { revision, locations: serverLocs.slice() },
      currentLocationId: "loc-root", breadcrumb: [{ name: "Rootville" }], destinations: [],
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
      assert.equal(w.bindings[mapsExport.idFor(w, zoneId)], zoneId, `zone ${zoneId} is bound (including the pre-seeded one)`);
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
      currentLocationId: "loc-root", breadcrumb: [{ name: "Rootville" }], destinations: [],
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
    const zoneIds = Object.keys(w.zones).filter((id) => id !== w.startZone);
    let raced = false;
    const posts = [];
    loadedPF.api.getSpatial = async () => ({
      definition: {
        revision: 3,
        locations: [{ id: "loc-root" }].concat(
          raced ? zoneIds.map((zoneId) => ({ id: mapsExport.idFor(w, zoneId) })) : [],
        ),
      },
      currentLocationId: "loc-root", breadcrumb: [{ name: "Rootville" }], destinations: [],
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
      currentLocationId: "loc-root", breadcrumb: [{ name: "Rootville" }], destinations: [],
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
      currentLocationId: "loc-root", breadcrumb: [{ name: "Rootville" }], destinations: [],
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
      currentLocationId: "loc-root", breadcrumb: [{ name: "Rootville" }], destinations: [],
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
    const zoneIds = Object.keys(w.zones).filter((id) => id !== w.startZone);
    const adoptedZone = zoneIds[0];
    const adoptedName = w.zones[adoptedZone].name;
    const posts = [];
    let serverLocs = [
      { id: "loc-root" },
      { id: "authored-1", parentId: "loc-root", name: `  ${adoptedName.toUpperCase()}  ` },
    ];
    loadedPF.api.getSpatial = async () => ({
      definition: { revision: 4, locations: serverLocs.slice() },
      currentLocationId: "loc-root", breadcrumb: [{ name: "Rootville" }], destinations: [],
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
    assert.equal(w.bindings["authored-1"], adoptedZone, "the authored location is bound (name match is trim+case-insensitive)");
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
    const zoneIds = Object.keys(w.zones).filter((id) => id !== w.startZone);
    const adoptedZone = zoneIds[0];
    const adoptedName = w.zones[adoptedZone].name;
    const posts = [];
    let serverLocs = [
      { id: "loc-root" },
      { id: "authored-1", parentId: "loc-root", name: adoptedName },
    ];
    loadedPF.api.getSpatial = async () => ({
      definition: { revision: 4, locations: serverLocs.slice() },
      currentLocationId: "loc-root", breadcrumb: [{ name: "Rootville" }], destinations: [],
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
      assert.equal(w.bindings[mapsExport.idFor(w, adoptedZone)], adoptedZone, "the shadowed zone creates its own id instead");
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
      currentLocationId: "loc-root", breadcrumb: [{ name: "Rootville" }], destinations: [],
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
    const zoneIds = Object.keys(w.zones).filter((id) => id !== w.startZone);
    let serverLocs = [{ id: "loc-root" }];
    const posts = [];
    loadedPF.api.getSpatial = async () => ({
      definition: { revision: 2, locations: serverLocs.slice() },
      currentLocationId: "loc-root", breadcrumb: [{ name: "Rootville" }], destinations: [],
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
      world: w2, zoneId: w2.startZone, mode: "walk",
      zone() { return this.world.zones[this.zoneId]; },
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
      currentLocationId: "loc-root", breadcrumb: [{ name: "Rootville" }], destinations: [],
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
      currentLocationId: "loc-root", breadcrumb: [{ name: "Rootville" }], destinations: [],
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
      currentLocationId: "loc-new-root", breadcrumb: [{ name: "New Root" }], destinations: [],
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
    w.bindings[mapsExport.idFor(w, Object.keys(w.zones).find((id) => id !== w.startZone))] = "z2";
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
      currentLocationId: "loc-root", breadcrumb: [{ name: "Rootville" }], destinations: [],
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

  loadedPF.api.getSpatial = prevGetSpatial;
  loadedPF.api.postSpatialLocations = prevPostLocations;
  resetExportState();
  loadedPF.spatial.reset();
}

console.log("brief validator + compiler: all cases passed");
