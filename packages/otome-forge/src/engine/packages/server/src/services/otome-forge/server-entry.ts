// ──────────────────────────────────────────────
// Otome Forge: server activation and the REST routes under /api/otome-forge
// ──────────────────────────────────────────────
// The server bundle may not import Engine storage, db or logger modules; everything goes through api.runtime.
import { forgeTimeZoneRoutes } from "@forge-kit/time-zone-server.mjs";
import type { CapabilityRuntimeHost } from "@marinara-engine/shared";
import { createHandle, type OtomeRouter, type RouteDeps } from "./http.js";
import { INDEX_ID } from "./ids.js";
import { registerIndexRoutes } from "./routes/index.js";
import { registerRunRoutes } from "./routes/runs.js";
import { registerSetupRoutes } from "./routes/setup.js";
import { normalizeIndex } from "./schemas/index.js";
import { createOtomeStore, type OtomeStore } from "./store.js";

type ActivationContext = {
  api: {
    runtime: CapabilityRuntimeHost;
    registerPrivilegedRoutes(
      routes: (router: OtomeRouter) => Promise<void>,
      options: { prefix: string },
    ): Promise<() => void | Promise<void>>;
  };
};

let activeStore: OtomeStore | null = null;

export async function activate({ api }: ActivationContext) {
  const store = createOtomeStore(api.runtime.persistence.documents);
  const handle = createHandle(api.runtime.logger);
  const deps: RouteDeps = { runtime: api.runtime, store, handle };
  // The Engine accepts only a prefix under /api/<package id> (capability-route-registration.service.ts). Every handler
  // runs in the request's time zone (forgeTimeZoneRoutes wraps get and post, the only methods Otome uses).
  const releaseRoutes = await api.registerPrivilegedRoutes(
    async (fastify) => {
      const router = forgeTimeZoneRoutes(fastify);
      registerIndexRoutes(router, deps);
      registerRunRoutes(router, deps);
      registerSetupRoutes(router, deps);
    },
    { prefix: "/api/otome-forge" },
  );
  activeStore = store;
  return async () => {
    if (activeStore === store) activeStore = null;
    await releaseRoutes();
  };
}

export async function selfCheck() {
  if (!activeStore) throw new Error("Otome Forge routes did not activate");
  // Reads the index, so broken storage fails here instead of on the first request.
  await activeStore.readDoc(INDEX_ID, normalizeIndex);
}
