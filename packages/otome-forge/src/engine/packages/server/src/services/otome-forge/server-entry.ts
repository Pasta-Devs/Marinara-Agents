// ──────────────────────────────────────────────
// Otome Forge: server activation and the REST routes under /api/otome-forge
// ──────────────────────────────────────────────
// The server bundle may not import Engine storage, db or logger modules; everything goes through api.runtime.
import { createForgeStoryCancellation } from "@forge-kit/story-cancel-server.mjs";
import { forgeTimeZoneRoutes } from "@forge-kit/time-zone-server.mjs";
import type { CapabilityRuntimeHost } from "@marinara-engine/shared";
import { createOtomeArt } from "./art/expressions.js";
import { createBackgroundQueue } from "./background-queue.js";
import { createHandle, type OtomeRouter, type RouteDeps } from "./http.js";
import { INDEX_ID } from "./ids.js";
import { createOtomeMemory } from "./memory/memory.js";
import { registerAlbumRoutes } from "./routes/album.js";
import { registerArcRoutes } from "./routes/arcs.js";
import { registerArtRoutes } from "./routes/art.js";
import { registerAudioRoutes } from "./routes/audio.js";
import { registerCareRoutes } from "./routes/care.js";
import { registerClawRoutes } from "./routes/claw.js";
import { registerDateRoutes } from "./routes/dates.js";
import { registerHomeRoutes } from "./routes/home.js";
import { registerIndexRoutes } from "./routes/index.js";
import { registerItemRoutes } from "./routes/items.js";
import { registerMemoryRoutes } from "./routes/memory.js";
import { registerPhoneRoutes } from "./routes/phone.js";
import { registerReadHimRoutes } from "./routes/read-him.js";
import { registerRunRoutes } from "./routes/runs.js";
import { registerSetupRoutes } from "./routes/setup.js";
import { registerStoryRoutes } from "./routes/story.js";
import { registerWardrobeRoutes } from "./routes/wardrobe.js";
import { registerWishRoutes } from "./routes/wish.js";
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
  const { runtime } = api;
  const store = createOtomeStore(runtime.persistence.documents);
  const handle = createHandle(runtime.logger);
  // One background lane (memory summaries and line packs), one story memory, one Cancel and one art service (faces,
  // places, CGs; M2b) per activation.
  const background = createBackgroundQueue(runtime);
  const memory = createOtomeMemory({ runtime, store, background });
  const cancellation = createForgeStoryCancellation();
  const art = createOtomeArt({ runtime, store });
  const deps: RouteDeps = { runtime, store, handle, memory, cancellation, art, background };
  // Wish's banner art paints in the background (M4); after teardown nothing more is paid for.
  let disposed = false;
  const active = () => !disposed;
  // The Engine accepts only a prefix under /api/<package id> (capability-route-registration.service.ts). Every handler
  // runs in the request's time zone (forgeTimeZoneRoutes wraps get and post, the only methods Otome uses).
  const releaseRoutes = await api.registerPrivilegedRoutes(
    async (fastify) => {
      const router = forgeTimeZoneRoutes(fastify);
      registerIndexRoutes(router, deps);
      registerRunRoutes(router, deps);
      registerSetupRoutes(router, deps);
      registerStoryRoutes(router, deps);
      registerArcRoutes(router, deps);
      registerArtRoutes(router, deps);
      registerAudioRoutes(router, deps);
      registerMemoryRoutes(router, { store, handle, memory });
      registerHomeRoutes(router, deps);
      registerPhoneRoutes(router, deps);
      registerWishRoutes(router, deps, { active });
      registerItemRoutes(router, deps);
      registerWardrobeRoutes(router, deps);
      registerAlbumRoutes(router, deps);
      registerCareRoutes(router, deps);
      registerClawRoutes(router, deps);
      registerReadHimRoutes(router, deps);
      registerDateRoutes(router, deps);
    },
    { prefix: "/api/otome-forge" },
  );
  activeStore = store;
  return async () => {
    if (activeStore === store) activeStore = null;
    // Nothing more is paid for after teardown: queued faces, scene paints and banner art stop before their paid call.
    disposed = true;
    art.dispose();
    cancellation.dispose();
    memory.dispose();
    background.dispose();
    await releaseRoutes();
  };
}

export async function selfCheck() {
  if (!activeStore) throw new Error("Otome Forge routes did not activate");
  // Reads the index, so broken storage fails here instead of on the first request.
  await activeStore.readDoc(INDEX_ID, normalizeIndex);
}
