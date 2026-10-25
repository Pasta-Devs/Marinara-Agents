import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { test } from "node:test";
import {
  forgeFormationMode,
  normalizeForgeFormationKit,
  normalizeForgeFormationRules,
  forgeFormationEnemyKit,
  forgeFormationTeamError,
} from "../packages/gacha-forge/src/formation-combat-shared.mjs";

const source = await readFile(
  new URL("../packages/gacha-forge/src/formation-combat-server.mjs", import.meta.url),
  "utf8",
);
const context = vm.createContext({
  forgeFormationMode,
  normalizeForgeFormationKit,
  normalizeForgeFormationRules,
  forgeFormationEnemyKit,
  forgeFormationTeamError,
});
vm.runInContext(source.replace(/^export /gmu, "") + "\nglobalThis.routesFactory=forgeFormationRoutes;", context);
const createRoutes = context.routesFactory;

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
  const fresh = await handlers.get("/battle/start")({ body: { runId: "world", expectedCombatMode: "formation" } });
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
  const response = await handlers.get("/battle")({ body: { runId: "world" } });
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
    body: { runId: "world", expectedCombatMode: "classic" },
  });
  assert.equal(response.error, "changed");
  assert.equal(called, false);
});
