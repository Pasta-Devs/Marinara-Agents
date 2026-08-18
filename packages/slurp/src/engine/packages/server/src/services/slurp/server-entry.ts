import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { slurpRoutes } from "../../routes/slurp.routes.js";
import { startNoodleAutoPostScheduler } from "./slurp-autopost-scheduler.service.js";
import { startNoodlerFanActivityScheduler } from "./slurp-fan-activity-scheduler.service.js";

let active = false;

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
  // Capability routes are registered through the host's revocable privileged route slots.
  // Noodle's existing plugin creates storage adapters while it registers, so
  // expose only the host database on the otherwise constrained collector.
  const routes: FastifyPluginAsync = async (router) => {
    await slurpRoutes(Object.assign(router, { db: app.db }) as FastifyInstance);
  };
  const cleanups = [
    await api.registerPrivilegedRoutes(routes, { prefix: "/api/slurp" }),
    api.registerService("slurp:backup", {
      pause: async <T>(run: () => Promise<T>) => run(),
    }),
  ];
  const schedulers = [startNoodleAutoPostScheduler(app), startNoodlerFanActivityScheduler(app)];
  active = true;
  return async () => {
    active = false;
    for (const scheduler of schedulers.reverse()) await scheduler.stop();
    for (const cleanup of cleanups.reverse()) await cleanup();
  };
}

export async function selfCheck() {
  if (!active) throw new Error("Noodle routes and schedulers did not activate");
}
