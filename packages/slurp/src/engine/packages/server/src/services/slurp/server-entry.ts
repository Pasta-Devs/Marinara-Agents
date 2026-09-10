import type { FastifyInstance, FastifyPluginAsync, InjectOptions } from "fastify";
import { slurpRoutes } from "../../routes/slurp.routes.js";
import { startNoodleAutoPostScheduler } from "./slurp-autopost-scheduler.service.js";
import { startNoodlerFanActivityScheduler } from "./slurp-fan-activity-scheduler.service.js";
import { startNoodleRefreshScheduler } from "./slurp-refresh-scheduler.service.js";
import { startSlurpMessageScheduler } from "./slurp-message-scheduler.service.js";
import { startSlurpFollowUpScheduler } from "./slurp-follow-up-scheduler.service.js";
import { startSlurpWorldScheduler } from "./slurp-world-scheduler.service.js";
import { createSlurpActivationLifecycle } from "./slurp-activation-lifecycle.js";
import { createSlurpStorage } from "../storage/slurp.storage.js";
import { createSlurpMessagesStorage } from "../storage/slurp-messages.storage.js";
import * as slurpSchema from "../../db/schema/slurp.js";
import { createSlurpFirstPostQueue } from "./slurp-first-post-queue.service.js";

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
    runInternalRoute?: (options: InjectOptions | string) => ReturnType<FastifyInstance["inject"]>;
  };
}) {
  return lifecycle.activate(async (addTeardown) => {
    // The host image only knows the Slurp tables that shipped inside it. Every table this
    // package added since then lives in the bundle alone, so the file store rejects it with
    // "Unsupported table" the moment a scheduler touches it. Register the package's own tables
    // first; the host skips names it already has, so this is safe to repeat.
    //
    // Hosts before the Engine gained `registerTables` cannot accept package-owned tables at all.
    // Skip rather than throw: the features that shipped with the host keep working, and the
    // newer ones start working the moment the host is updated.
    const registerTables = app.db._fileStore.registerTables?.bind(app.db._fileStore);
    if (registerTables) await registerTables(Object.values(slurpSchema));
    else app.log?.warn("[slurp] host cannot register package tables; newer Slurp features are off");

    await createSlurpStorage(app.db).migrateLegacyNoodlerSourceSnapshots();
    await createSlurpMessagesStorage(app.db).migrateLegacyFollowUps();
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
    const firstPostQueue = createSlurpFirstPostQueue(app.db);
    firstPostQueue.start();
    addTeardown(() => firstPostQueue.stop());
    startNoodleAutoPostScheduler(app, addTeardown);
    startNoodlerFanActivityScheduler(app, addTeardown);
    startNoodleRefreshScheduler(app, addTeardown, api.runInternalRoute);
    startSlurpMessageScheduler(app, addTeardown);
    startSlurpFollowUpScheduler(app, addTeardown);
    startSlurpWorldScheduler(app, addTeardown);
  });
}

export async function selfCheck() {
  lifecycle.selfCheck();
}
