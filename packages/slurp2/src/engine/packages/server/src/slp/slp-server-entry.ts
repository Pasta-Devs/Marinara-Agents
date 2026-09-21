import { slpDeepDetailsRoutes } from "./features/feed/slp-deep-details-routes.js";
import type { FastifyInstance, FastifyPluginAsync, InjectOptions } from "fastify";
import { createSlpRouteHost } from "./features/viewer/slp-route-host.js";
import { createSlpViewerContext } from "./features/viewer/slp-viewer-context.js";
import { slpMediaRoutes } from "./features/media/slp-media-routes.js";
import { slpSettingsRoutes } from "./features/settings/slp-settings-routes.js";
import { slpAdsRoutes } from "./features/ads/slp-ads-routes.js";
import { slpAudienceRoutes } from "./features/audience/slp-audience-routes.js";
import { slpImprovementRoutes } from "./features/creators/improvement/slp-improvement-routes.js";
import { slpCreatorsRoutes } from "./features/creators/slp-creators-routes.js";
import { slpDiscoveryRoutes } from "./features/discovery/slp-discovery-routes.js";
import { slpStudioRoutes } from "./features/economy/slp-studio-routes.js";
import { slpWalletRoutes } from "./features/economy/slp-wallet-routes.js";
import { slpFeedPostRoutes } from "./features/feed/slp-feed-post-routes.js";
import { slpFeedPublishingRoutes } from "./features/feed/slp-feed-publishing-routes.js";
import { slpFeedViewerRoutes } from "./features/feed/slp-feed-viewer-routes.js";
import { slpBackupRoutes } from "./features/maintenance/slp-backup-routes.js";
import { slpMaintenanceRoutes } from "./features/maintenance/slp-maintenance-routes.js";
import { slpMessagesRoutes } from "./features/messages/slp-messages-routes.js";
import { slpNotificationsRoutes } from "./features/notifications/slp-notifications-routes.js";
import { slpOnboardingRoutes } from "./features/onboarding/slp-onboarding-routes.js";
import { slpProjectsRoutes } from "./features/projects/slp-projects-routes.js";
import { slpCatchUpWorldOnOpen } from "./workflows/slp-world-tick-workflow.js";
import { startSlpAutoPostScheduler } from "./features/feed/slp-autopost-scheduler-service.js";
import { startCreatorFanActivityScheduler } from "./features/audience/slp-fan-activity-scheduler-service.js";
import { startSlpRefreshScheduler } from "./features/feed/slp-refresh-scheduler-service.js";
import { startSlurpMessageScheduler } from "./features/messages/slp-message-scheduler-service.js";
import { startSlurpFollowUpScheduler } from "./features/messages/slp-follow-up-scheduler-service.js";
import { startSlurpPaymentRecoveryScheduler } from "./features/economy/slp-payment-recovery-scheduler-service.js";
import { startSlurpWorldScheduler } from "./features/world/slp-world-scheduler-service.js";
import { createSlurpActivationLifecycle } from "./base/locking/slp-activation-lifecycle.js";
import { createSlurpMessagesStorage } from "./data/slp-storage.js";
import { createSlurpStorage } from "./data/slp-storage.js";
import { createSlurpPopulationStorage } from "./data/audience/slp-audience-storage-funnel.js";
import * as slurpSchema from "../db/schema/slurp.js";
import { createSlurpFirstPostQueue } from "./features/onboarding/slp-first-post-queue-service.js";
import { startSlurpAutopurgeScheduler } from "./features/maintenance/slp-autopurge-scheduler-service.js";
import { buildSlurpChatContext, type SlurpChatContextRequest } from "./features/creators/slp-chat-context.js";

const lifecycle = createSlurpActivationLifecycle();

/** Every Slurp HTTP route. Shared handles and mutable route state are created once, here. */
export async function mountSlpRoutes(app: FastifyInstance) {
  const noodle = createSlurpStorage(app.db);
  const population = createSlurpPopulationStorage(app.db);
  const messages = createSlurpMessagesStorage(app.db);
  const host = createSlpRouteHost(app, noodle);
  const deps = {
    ...host,
    noodle,
    messages,
    population,
    ...createSlpViewerContext(app, host, population.countFollowersForCreators),
  };
  await slpSettingsRoutes(app, deps);
  await slpAudienceRoutes(app, deps);
  await slpMaintenanceRoutes(app, deps);
  await slpProjectsRoutes(app, deps);
  await slpDiscoveryRoutes(app, deps);
  await slpCreatorsRoutes(app, deps);
  await slpImprovementRoutes(app, deps);
  await slpBackupRoutes(app, deps);
  await slpWalletRoutes(app, deps);
  await slpMediaRoutes(app, deps);
  await slpNotificationsRoutes(app, deps, slpCatchUpWorldOnOpen);
  await slpStudioRoutes(app, deps);
  await slpFeedViewerRoutes(app, deps);
  await slpAdsRoutes(app, deps);
  await slpFeedPostRoutes(app, deps);
  await slpDeepDetailsRoutes(app, deps);
  await slpOnboardingRoutes(app, deps);
  await slpFeedPublishingRoutes(app, deps);
  await slpMessagesRoutes(app, noodle, messages);
}

export async function activate({
  app,
  api,
}: {
  app: FastifyInstance;
  api: {
    registerService<T>(key: string, service: T): () => void | Promise<void>;
    registerPromptContext?(
      contributor: (request: SlurpChatContextRequest) => Promise<string | null>,
    ): () => void | Promise<void>;
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
    const noodle = createSlurpStorage(app.db);
    const population = createSlurpPopulationStorage(app.db);
    const messagesStorage = createSlurpMessagesStorage(app.db);
    await messagesStorage.recoverPendingPayments();
    // Capability routes are registered through the host's revocable privileged route slots.
    // Noodle's existing plugin creates storage adapters while it registers, so expose only the
    // host database on the otherwise constrained collector.
    const routes: FastifyPluginAsync = async (router) => {
      await mountSlpRoutes(Object.assign(router, { db: app.db, noodle }) as FastifyInstance);
    };
    addTeardown(await api.registerPrivilegedRoutes(routes, { prefix: "/api/slurp2" }));
    addTeardown(
      api.registerService("slurp2:backup", {
        pause: async <T>(run: () => Promise<T>) => run(),
      }),
    );
    // Slurp activity in ordinary chats. Each chat opts in, so registering costs nothing until then.
    if (api.registerPromptContext) {
      addTeardown(api.registerPromptContext((request) => buildSlurpChatContext(app.db, request)));
    }
    const firstPostQueue = createSlurpFirstPostQueue(app.db);
    firstPostQueue.start();
    addTeardown(() => firstPostQueue.stop());
    startSlpAutoPostScheduler(app, addTeardown);
    startCreatorFanActivityScheduler(app, addTeardown);
    startSlpRefreshScheduler(app, addTeardown, api.runInternalRoute);
    startSlurpMessageScheduler(app, addTeardown);
    startSlurpPaymentRecoveryScheduler(app, addTeardown);
    startSlurpFollowUpScheduler(app, addTeardown);
    startSlurpWorldScheduler(app, addTeardown);
    startSlurpAutopurgeScheduler(app, addTeardown);
  });
}

export async function selfCheck() {
  lifecycle.selfCheck();
}
