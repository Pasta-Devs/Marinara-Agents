import type { FastifyPluginAsync } from "fastify";
import { registerDraftRoutes } from "./routes/drafts.js";
import { registerImportRoutes } from "./routes/imports.js";
import { registerMaintenanceRoutes } from "./routes/maintenance.js";
import { registerNotesRoutes } from "./routes/notes.js";
import { registerSettingsRoutes } from "./routes/settings.js";
import type { LtmRouteRuntime } from "./routes/shared.js";

export function createLongTermMemoryRoutes(runtime: LtmRouteRuntime): FastifyPluginAsync {
  return async (app) => {
    registerMaintenanceRoutes(app, runtime);
    registerSettingsRoutes(app, runtime);
    registerNotesRoutes(app, runtime);
    registerImportRoutes(app, runtime);
    registerDraftRoutes(app, runtime);
  };
}
