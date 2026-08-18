import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { noodleRoutes } from "../../routes/noodle.routes.js";
import { buildRecentSocialMediaActivityBlock } from "./noodle-context.js";
import { startNoodleRefreshScheduler } from "./noodle-refresh-scheduler.service.js";

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
  // Noodle exposes only the public timeline capability. Creator routes live in their separate package.
  const routes: FastifyPluginAsync = async (router) => {
    // Noodle exposes only the public timeline capability. Creator routes run in Slurp.
    await noodleRoutes(Object.assign(router, { db: app.db }) as FastifyInstance);
  };
  const cleanups = [
    await api.registerPrivilegedRoutes(routes, { prefix: "/api/noodle" }),
    api.registerService("noodle:backup", { pause: async <T>(run: () => Promise<T>) => run() }),
    api.registerService("noodle:prompt-context", { build: buildRecentSocialMediaActivityBlock }),
  ];
  const schedulers = [startNoodleRefreshScheduler(app)];
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
