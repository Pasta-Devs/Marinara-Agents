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
const source = ["00-prelude.js", "10-art.js", "18-brief.js", "20-world.js", "30-sim.js", "50-spatial.js"]
  .map((file) => readFileSync(join(here, "src", file), "utf8"))
  .join("\n");
const loadedPF = new Function(`"use strict";\n${source}\nreturn PF;`)();
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
  const c = JSON.stringify(brief.validate(degenerate, { ...ctx, seed: 7 }));
  assert.notEqual(a, c, "top-ups derive from the seed");
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
  // Buildings honor the arithmetic: at least one roof per household group, and
  // the settlement spawn is walkable.
  const v = w.zones.z1;
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
  const innkeeper = Object.values(w.zones).flatMap((z) => z.npcs).find((n) => n.name === "Perrin");
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
}

// 22-25. The §5 failure ladder (amended): transients leave the chat UNSEALED,
// truncation re-rolls plainly and salvages the longest raw across attempts,
// and only deterministic/paid failures seal the themed default.
{
  loadedPF.api = loadedPF.api ?? {};
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
  calls.length = 0;
  stub([
    { status: 409, body: { code: "chat_busy" } },
    { status: 200, body: { ok: true, data: { scale: "hamlet", name: "Busyville", cast: [] } } },
  ]);
  const busySeal = await brief.generate("c", { theme: "cozy-village", seed: 3, preferences: "x".repeat(9000), budgetMs: 1200 });
  assert.equal(calls.length, 2, "busy → one wait-out retry");
  assert.ok(calls[0].userContent.length <= 7_801, "userContent clamped under the route cap");
  assert.equal(busySeal.name, "Busyville", "the wait-out retry seals the real brief");
}

console.log("brief validator + compiler: all cases passed");
