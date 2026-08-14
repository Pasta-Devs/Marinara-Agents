import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { noodleRoutes } from "../../routes/noodle.routes.js";
import { startNoodleAutoPostScheduler } from "./noodle-autopost-scheduler.service.js";
import { withNoodleAutoPostPaused } from "./noodle-autopost-scheduler.service.js";
import { buildRecentSocialMediaActivityBlock } from "./noodle-context.js";
import { startNoodlerFanActivityScheduler } from "./noodle-fan-activity-scheduler.service.js";
import { startNoodleRefreshScheduler } from "./noodle-refresh-scheduler.service.js";

let active = false;

export async function activate({
  app,
  api,
}: {
  app: FastifyInstance;
  api: {
    registerService<T>(key: string, service: T): () => void | Promise<void>;
    registerPrivilegedRoutes(routes: FastifyPluginAsync, options: { prefix: string }): Promise<() => void | Promise<void>>;
  };
}) {
  // Capability routes are registered through the host's revocable privileged route slots.
  // This is also the authentication boundary for owner-only NoodleR management paths;
  // do not register these handlers through an unrestricted route API.
  // Noodle's existing plugin creates storage adapters while it registers, so
  // expose only the host database on the otherwise constrained collector.
  const routes: FastifyPluginAsync = async (router) => {
    await noodleRoutes(Object.assign(router, { db: app.db }) as FastifyInstance);
  };
  const cleanups = [
    await api.registerPrivilegedRoutes(routes, { prefix: "/api/noodle" }),
    api.registerService("noodle:backup", { pause: withNoodleAutoPostPaused }),
    api.registerService("noodle:prompt-context", { build: buildRecentSocialMediaActivityBlock }),
  ];
  const schedulers = [
    startNoodleRefreshScheduler(app),
    startNoodleAutoPostScheduler(app),
    startNoodlerFanActivityScheduler(app),
  ];
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
