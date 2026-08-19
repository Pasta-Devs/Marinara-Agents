import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { slurpRoutes } from "../../routes/slurp.routes.js";
import { startNoodleAutoPostScheduler } from "./slurp-autopost-scheduler.service.js";
import { startNoodlerFanActivityScheduler } from "./slurp-fan-activity-scheduler.service.js";
import { startNoodleRefreshScheduler } from "./slurp-refresh-scheduler.service.js";

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
  if (active) throw new Error("Slurp is already active");
  active = true;
  // Capability routes are registered through the host's revocable privileged route slots.
  // Noodle's existing plugin creates storage adapters while it registers, so
  // expose only the host database on the otherwise constrained collector.
  const routes: FastifyPluginAsync = async (router) => {
    await slurpRoutes(Object.assign(router, { db: app.db }) as FastifyInstance);
  };
  const cleanups: Array<() => void | Promise<void>> = [];
  const schedulers: Array<{ stop: () => void | Promise<void> }> = [];
  let tornDown = false;
  const teardown = async () => {
    if (tornDown) return;
    tornDown = true;
    let firstError: unknown = null;
    let failed = false;
    for (const scheduler of schedulers.reverse()) {
      try {
        await scheduler.stop();
      } catch (error) {
        failed = true;
        firstError ??= error;
      }
    }
    for (const cleanup of cleanups.reverse()) {
      try {
        await cleanup();
      } catch (error) {
        failed = true;
        firstError ??= error;
      }
    }
    active = false;
    if (failed) throw firstError;
  };
  try {
    cleanups.push(await api.registerPrivilegedRoutes(routes, { prefix: "/api/slurp" }));
    cleanups.push(
      api.registerService("slurp:backup", {
        pause: async <T>(run: () => Promise<T>) => run(),
      }),
    );
    schedulers.push(startNoodleAutoPostScheduler(app));
    schedulers.push(startNoodlerFanActivityScheduler(app));
    schedulers.push(startNoodleRefreshScheduler(app));
    return teardown;
  } catch (error) {
    try {
      await teardown();
    } catch {
      // Preserve the activation error after best-effort rollback.
    }
    throw error;
  }
}

export async function selfCheck() {
  if (!active) throw new Error("Noodle routes and schedulers did not activate");
}
