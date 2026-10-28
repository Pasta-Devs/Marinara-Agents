// ──────────────────────────────────────────────
// Otome Forge: server activation and the REST routes under /api/otome-forge
// ──────────────────────────────────────────────
// The server bundle may not import Engine storage, db or logger modules; everything goes through api.runtime.
import type { CapabilityRuntimeHost } from "@marinara-engine/shared";
import { createHandle, type OtomeRouter } from "./http.js";
import { INDEX_ID } from "./ids.js";
import { registerIndexRoutes } from "./routes/index.js";
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
  // No time-zone wrapper yet: no route depends on the player's day before M1.
  // The Engine accepts only a prefix under /api/<package id> (capability-route-registration.service.ts).
  const releaseRoutes = await api.registerPrivilegedRoutes(
    async (router) => {
      registerIndexRoutes(router, { store, handle });
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
