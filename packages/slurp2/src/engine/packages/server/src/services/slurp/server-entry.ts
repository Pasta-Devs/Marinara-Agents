import type { FastifyInstance, FastifyPluginAsync, InjectOptions } from "fastify";
import { slurpRoutes } from "../../routes/slurp.routes.js";
import { startNoodleAutoPostScheduler } from "./slurp-autopost-scheduler.service.js";
import { startNoodlerFanActivityScheduler } from "./slurp-fan-activity-scheduler.service.js";
import { startNoodleRefreshScheduler } from "./slurp-refresh-scheduler.service.js";
import { startSlurpMessageScheduler } from "./slurp-message-scheduler.service.js";
import { startSlurpFollowUpScheduler } from "./slurp-follow-up-scheduler.service.js";
import { startSlurpPaymentRecoveryScheduler } from "./slurp-payment-recovery-scheduler.service.js";
import { startSlurpWorldScheduler } from "./slurp-world-scheduler.service.js";
import { createSlurpActivationLifecycle } from "./slurp-activation-lifecycle.js";
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
    // Every `slurp2_*` table lives in this bundle alone. The host image knows only the legacy
    // `slurp_*` names, and `registerTables` never namespaces by package: on a name clash the
    // existing definition wins with a warning. Owning a distinct prefix is what keeps this
    // package's data separate from a legacy Slurp installed beside it.
    //
    // That makes `registerTables` mandatory, not best-effort. A host without it has nowhere to
    // put any of this package's data, so fail activation with a message the user can act on
    // rather than degrade into a Slurp with no storage.
    const registerTables = app.db._fileStore.registerTables?.bind(app.db._fileStore);
    if (!registerTables) {
      throw new Error(
        "[slurp2] This Marinara Engine is too old: it cannot register package-owned tables. Update the Engine to 2.4.5 or newer.",
      );
    }
    await registerTables(Object.values(slurpSchema));

    // No legacy migration runs here. Every slurp2 install starts empty, and a legacy Slurp may
    // be installed alongside this one — its rows are not ours to read, move, or rewrite.
    const messagesStorage = createSlurpMessagesStorage(app.db);
    await messagesStorage.recoverPendingPayments();
    // Capability routes are registered through the host's revocable privileged route slots.
    // Noodle's existing plugin creates storage adapters while it registers, so expose only the
    // host database on the otherwise constrained collector.
    const routes: FastifyPluginAsync = async (router) => {
      await slurpRoutes(Object.assign(router, { db: app.db }) as FastifyInstance);
    };
    addTeardown(await api.registerPrivilegedRoutes(routes, { prefix: "/api/slurp2" }));
    addTeardown(
      api.registerService("slurp2:backup", {
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
    startSlurpPaymentRecoveryScheduler(app, addTeardown);
    startSlurpFollowUpScheduler(app, addTeardown);
    startSlurpWorldScheduler(app, addTeardown);
  });
}

export async function selfCheck() {
  lifecycle.selfCheck();
}
