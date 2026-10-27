import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { test } from "node:test";
import * as shared from "../packages/gacha-forge/src/formation-combat-shared.mjs";

const source = await readFile(
  new URL("../packages/gacha-forge/src/formation-combat-server.mjs", import.meta.url),
  "utf8",
);
const context = vm.createContext({ ...shared });
vm.runInContext(source.replace(/^export /gmu, "") + "\nglobalThis.routesFactory=forgeFormationRoutes;", context);
const createRoutes = context.routesFactory;
// What a current client sends with every Formation start.
const current = {
  expectedFormationEngine: shared.FORGE_FORMATION_ENGINE,
  expectedFormationRules: shared.FORGE_FORMATION_RULES,
};

test("a mode committed during admission is reread and a stale preview cannot start or spend", async () => {
  let run = { combat: { mode: "classic", revision: 0 } },
    calls = 0,
    admitted = false;
  const handlers = new Map();
  const routes = createRoutes(
    { post: (path, handler) => handlers.set(path, handler) },
    {
      readWorld: async () => {
        assert.equal(admitted, true, "world mode is read inside admission");
        return structuredClone(run);
      },
      migration: {
        guard: async () => {
          run = { combat: { mode: "formation", revision: 1 } };
          return { ok: true };
        },
        ensure: async () => ({ ok: true }),
      },
      cancellation: {
        mutate: async (_runId, operation) => {
          admitted = true;
          try {
            return await operation();
          } finally {
            admitted = false;
          }
        },
      },
    },
  );
  routes.post("/battle/start", async () => {
    calls += 1;
    return { ok: true, spent: 20 };
  });
  const stale = await handlers.get("/battle/start")({ body: { runId: "world", expectedCombatMode: "classic" } });
  assert.equal(stale.error, "changed");
  assert.equal(calls, 0);
  const fresh = await handlers.get("/battle/start")({
    body: { runId: "world", expectedCombatMode: "formation", ...current },
  });
  assert.equal(fresh.ok, true);
  assert.equal(fresh.combatMode, "formation");
  assert.equal(calls, 1);
});

test("a completed preview retains the mode of the actors it actually built", async () => {
  const handlers = new Map(),
    hero = { id: "hero", position: "front", affinity: "Fire" },
    foe = { id: "foe", position: "front" };
  const routes = createRoutes(
    { post: (path, handler) => handlers.set(path, handler) },
    {
      readWorld: async () => ({ combat: { mode: "formation", revision: 1 } }),
      migration: { guard: async () => ({ ok: true }), ensure: async () => ({ ok: true }) },
      cancellation: {},
    },
  );
  routes.post("/battle", async () => ({ ok: true, combatMode: "classic", allies: [hero], enemies: [foe] }));
  const response = await handlers.get("/battle")({ body: { runId: "world", ...current } });
  assert.equal(response.ok, true);
  assert.equal(response.combatMode, "classic");
  assert.equal(response.enemies[0].formationKit, undefined);
});

test("future story-event battle starts share the same admission and preview mode guard", async () => {
  const handlers = new Map();
  let called = false;
  const routes = createRoutes(
    { post: (path, handler) => handlers.set(path, handler) },
    {
      readWorld: async () => ({ combat: { mode: "formation" } }),
      migration: { guard: async () => ({ ok: true }), ensure: async () => ({ ok: true }) },
      cancellation: { mutate: async (_runId, operation) => operation() },
    },
  );
  routes.post("/story-event/battle/start", async () => {
    called = true;
    return { ok: true };
  });
  const response = await handlers.get("/story-event/battle/start")({
    body: { runId: "world", expectedCombatMode: "classic", ...current },
  });
  assert.equal(response.error, "changed");
  assert.equal(called, false);
});

test("a Formation preview or start from a tab on an older engine or rules spends nothing; Classic never needs them", async () => {
  const paths = [
    "/battle",
    "/battle/start",
    "/farm/battle",
    "/farm/start",
    "/tower/battle",
    "/tower/start",
    "/story-event/battle",
    "/story-event/battle/start",
  ];
  for (const [mode, body, expected] of [
    ["formation", {}, "formation-engine-changed"],
    ["formation", { ...current, expectedFormationEngine: 1 }, "formation-engine-changed"],
    // A 1.24.0 tab names engine 2 but no rules revision: it resolves fights by rules this server no longer uses.
    ["formation", { expectedFormationEngine: shared.FORGE_FORMATION_ENGINE }, "formation-engine-changed"],
    ["formation", { ...current, expectedFormationRules: shared.FORGE_FORMATION_RULES - 1 }, "formation-engine-changed"],
    ["formation", current, null],
    ["classic", {}, null],
  ]) {
    const handlers = new Map();
    let calls = 0,
      ensured = 0;
    const routes = createRoutes(
      { post: (path, handler) => handlers.set(path, handler) },
      {
        readWorld: async () => ({ combat: { mode } }),
        migration: {
          guard: async () => ({ ok: true }),
          ensure: async () => {
            ensured += 1;
            return { ok: true };
          },
        },
        cancellation: { mutate: async (_runId, operation) => operation() },
      },
    );
    for (const path of paths)
      routes.post(path, async () => {
        calls += 1;
        return { ok: true, spent: 20 };
      });
    for (const path of paths) {
      const response = await handlers.get(path)({ body: { runId: "world", ...body } });
      assert.equal(response.error ?? null, expected, `${mode} ${path} ${JSON.stringify(body)}`);
    }
    assert.equal(calls, expected ? 0 : paths.length, "a refused tab never reaches the paid handler");
    // An older tab is turned away before ensure could start a paid kit remake; a current one reaches it.
    assert.equal(ensured, expected ? 0 : paths.length, "a refused tab never reaches the kit remake");
  }
});

test("the team editor saves any seating; Formation seats six and only a battle start checks the rows", async () => {
  const handlers = new Map();
  let saved = null;
  const routes = createRoutes(
    { post: (path, handler) => handlers.set(path, handler) },
    {
      readWorld: async () => ({ combat: { mode: "formation" } }),
      migration: { guard: async () => ({ ok: true }), ensure: async () => ({ ok: true }) },
      cancellation: {},
    },
  );
  routes.post("/formation/save", async (request) => {
    saved = request.body;
    return { ok: true };
  });
  const presets = [{ board: { front: ["a", "b", "c"], back: ["d", "e", "f"] } }];
  assert.equal((await handlers.get("/formation/save")({ body: { runId: "world", presets, active: 0 } })).ok, true);
  assert.deepEqual(saved.presets, presets);
  const six = ["a", "b", "c", "d", "e", "f"].map((id, index) => ({ id, position: index < 3 ? "front" : "back" }));
  assert.equal(shared.forgeFormationTeamError(six), null);
  assert.equal(shared.forgeFormationTeamError([...six, { id: "g", position: "back" }]), "formation-team-size");
  assert.equal(shared.forgeFormationTeamError(six.slice(3)), "formation-rows");
});
