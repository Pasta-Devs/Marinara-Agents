import { slpDeepDetailsRoutes } from "./features/feed/slp-deep-details-routes.js";
import { slpCanonAnchorRoutes } from "./features/feed/slp-canon-anchor-routes.js";
import type { SceneOriginProvider } from "@marinara-engine/shared";
import { createSlpSceneOriginProvider } from "./features/messages/scenes/slp-roleplay-scene-origin.js";
import { setSlpScenesAvailable } from "./base/host/slp-scene-host.js";
import type { FastifyInstance, FastifyPluginAsync, InjectOptions } from "fastify";
import { createSlpRouteHost } from "./features/viewer/slp-route-host.js";
import { createSlpViewerContext } from "./features/viewer/slp-viewer-context.js";
import { slpMediaRoutes } from "./features/media/slp-media-routes.js";
import { slpSettingsRoutes } from "./features/settings/slp-settings-routes.js";
import { slpAdsRoutes } from "./features/ads/slp-ads-routes.js";
import { slpBrandsRoutes } from "./features/ads/slp-brands-routes.js";
import { slpAudienceRoutes } from "./features/audience/slp-audience-routes.js";
import { slpImprovementRoutes } from "./features/creators/improvement/slp-improvement-routes.js";
import { slpCreatorsRoutes } from "./features/creators/slp-creators-routes.js";
import { slpSteeringRoutes } from "./features/creators/slp-steering-routes.js";
import { slpSpiceRoutes } from "./features/creators/slp-spice-routes.js";
import { slpDiscoveryRoutes } from "./features/discovery/slp-discovery-routes.js";
import { slpStudioRoutes } from "./features/economy/slp-studio-routes.js";
import { slpCreatorTiesRoutes } from "./features/projects/slp-creator-ties-routes.js";
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
import { slpAssistRoutes } from "./features/assist/slp-assist-routes.js";
import { slpStirRoutes } from "./features/assist/slp-stir-routes.js";
import { slpActionService } from "./features/assist/slp-action-runner.js";
import { slpActionServiceKeys } from "../../../shared/src/slp/slp-actions.js";
import { logger } from "../lib/logger.js";
import { slpCatchUpWorldOnOpen } from "./workflows/slp-world-tick-workflow.js";
import { startSlpAutoPostScheduler } from "./features/feed/slp-autopost-scheduler-service.js";
import { startCreatorFanActivityScheduler } from "./features/audience/slp-fan-activity-scheduler-service.js";
import { startSlpRefreshScheduler } from "./features/feed/slp-refresh-scheduler-service.js";
import { startSlurpMessageScheduler } from "./features/messages/slp-message-scheduler-service.js";
import { startSlurpFollowUpScheduler } from "./features/messages/slp-follow-up-scheduler-service.js";
import { startSlurpPaymentRecoveryScheduler } from "./features/economy/slp-payment-recovery-scheduler-service.js";
import { startSlurpWorldScheduler } from "./features/world/slp-world-scheduler-service.js";
import { slpStoryRoutes } from "./features/world/slp-story-routes.js";
import { slpDramaRoutes } from "./features/world/slp-drama-routes.js";
import { createSlurpActivationLifecycle } from "./base/locking/slp-activation-lifecycle.js";
import { createSlurpMessagesStorage } from "./data/slp-storage.js";
import { migrateSlurpSupportThreads } from "./data/messages/slp-support-migration.js";
import { createSlurpStorage } from "./data/slp-storage.js";
import { createSlurpPopulationStorage } from "./data/audience/slp-audience-storage-funnel.js";
import * as slurpSchema from "../db/schema/slurp.js";
import { createSlurpFirstPostQueue } from "./features/onboarding/slp-first-post-queue-service.js";
import { startSlurpAutopurgeScheduler } from "./features/maintenance/slp-autopurge-scheduler-service.js";
import { buildSlurpChatContext, type SlurpChatContextRequest } from "./features/creators/slp-chat-context.js";
import type { CapabilityIntegrationHost } from "@marinara-engine/shared";
import { setSlurpGenerationIntegrations } from "./base/host/slp-generation-integrations.js";

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
  await slpStoryRoutes(app, deps);
  await slpDramaRoutes(app, deps);
  await slpDiscoveryRoutes(app, deps);
  await slpCreatorsRoutes(app, deps);
  await slpSteeringRoutes(app, deps);
  await slpSpiceRoutes(app);
  await slpImprovementRoutes(app, deps);
  await slpBackupRoutes(app, deps);
  await slpWalletRoutes(app, deps);
  await slpMediaRoutes(app, deps);
  await slpNotificationsRoutes(app, deps, slpCatchUpWorldOnOpen);
  await slpStudioRoutes(app, deps);
  await slpCreatorTiesRoutes(app, deps);
  await slpFeedViewerRoutes(app, deps);
  await slpAdsRoutes(app, deps);
  await slpBrandsRoutes(app, deps);
  await slpFeedPostRoutes(app, deps);
  await slpDeepDetailsRoutes(app, deps);
  await slpCanonAnchorRoutes(app, deps);
  await slpOnboardingRoutes(app, deps);
  await slpFeedPublishingRoutes(app, deps);
  await slpAssistRoutes(app);
  await slpStirRoutes(app, deps);
  await slpMessagesRoutes(app, noodle, messages);
}

export async function activate({
  app,
  api,
  package: installed,
}: {
  app: FastifyInstance;
  /** The installed package; its manifest's permissions say whether Professor Mari may act (J2). */
  package?: { manifest?: { permissions?: readonly string[] } };
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
    /** Capability API 1.66 with the `scenes` permission: DM threads become scene origins. */
    registerSceneOrigin?(provider: SceneOriginProvider): () => void | Promise<void>;
    runtime?: { integrations?: CapabilityIntegrationHost };
  };
}) {
  return lifecycle.activate(async (addTeardown) => {
    const integrations = api.runtime?.integrations;
    if (!integrations) {
      throw new Error(
        "[slurp2] This Marinara Engine does not provide Capability API 1.31 generation integrations. Update the Engine to 2.4.6 or newer.",
      );
    }
    setSlurpGenerationIntegrations(integrations);
    addTeardown(() => setSlurpGenerationIntegrations(undefined));
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
    // Slurp Support has one thread per Creator; older data (and restored backups) kept its lines in
    // persona chats. Idempotent, so it runs on every start.
    await migrateSlurpSupportThreads(app.db);
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
    // The action layer as an in-process service (docs/architecture/README.md "Action layer"). On an
    // Engine with Capability API 1.50 and the `mari-actions` permission, Professor Mari lists and runs
    // the same actions through `mari-actions:slurp2`; older Engines only get `slurp2:actions`.
    const actions = slpActionService(app.db);
    for (const key of slpActionServiceKeys(installed?.manifest?.permissions)) {
      try {
        addTeardown(api.registerService(key, actions));
      } catch (error) {
        logger.warn(error, `[slurp2] Could not offer Slurp actions as ${key}; the app works without it`);
      }
    }
    // Roleplay scenes from DM threads (docs/SCENES.md). The builder adds `scenes` once Slurp declares
    // Capability API 1.66; without it the Start a scene action stays hidden and nothing registers.
    if (api.registerSceneOrigin && installed?.manifest?.permissions?.includes("scenes")) {
      addTeardown(api.registerSceneOrigin(createSlpSceneOriginProvider(app.db)));
      setSlpScenesAvailable(true);
      addTeardown(() => setSlpScenesAvailable(false));
    }
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
