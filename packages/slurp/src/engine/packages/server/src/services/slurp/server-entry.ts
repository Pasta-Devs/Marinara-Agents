import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { slurpRoutes } from "../../routes/slurp.routes.js";
import { startNoodleAutoPostScheduler } from "./slurp-autopost-scheduler.service.js";
import { startNoodlerFanActivityScheduler } from "./slurp-fan-activity-scheduler.service.js";
import { startNoodleRefreshScheduler } from "./slurp-refresh-scheduler.service.js";
import { createSlurpActivationLifecycle } from "./slurp-activation-lifecycle.js";
import { createSlurpStorage } from "../storage/slurp.storage.js";

const lifecycle = createSlurpActivationLifecycle();

export async function activate({
  app,
  api,
}: {
  app: FastifyInstance;
  api: {
    registerService<T>(key: string, service: T): () => void | Promise<void>;
    registerPrivilegedRoutes(
      routes: FastifyPluginAsync,
      options: { prefix: string },
    ): Promise<() => void | Promise<void>>;
  };
}) {
  return lifecycle.activate(async (addTeardown) => {
    await createSlurpStorage(app.db).migrateLegacyNoodlerSourceSnapshots();
    // Capability routes are registered through the host's revocable privileged route slots.
    // Noodle's existing plugin creates storage adapters while it registers, so expose only the
    // host database on the otherwise constrained collector.
    const routes: FastifyPluginAsync = async (router) => {
      await slurpRoutes(Object.assign(router, { db: app.db }) as FastifyInstance);
    };
    addTeardown(await api.registerPrivilegedRoutes(routes, { prefix: "/api/slurp" }));
    addTeardown(
      api.registerService("slurp:backup", {
        pause: async <T>(run: () => Promise<T>) => run(),
      }),
    );
    startNoodleAutoPostScheduler(app, addTeardown);
    startNoodlerFanActivityScheduler(app, addTeardown);
    startNoodleRefreshScheduler(app, addTeardown);
  });
}

export async function selfCheck() {
  lifecycle.selfCheck();
}
