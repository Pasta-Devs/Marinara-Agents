// ──────────────────────────────────────────────
// Virtual Phone — capability entrypoint
// ──────────────────────────────────────────────
import type { FastifyPluginAsync } from "fastify";
import { PHONE_APPS } from "./apps.js";
import { configurePackageRuntime, type CapabilityRuntimeHost } from "./package-runtime.js";
import { clearPageCache, createVirtualPhoneRoutes } from "./routes.js";
import { PHONE_TEMPLATES, extractSlots } from "./templates.js";

type Api = {
  runtime: CapabilityRuntimeHost;
  registerPrivilegedRoutes(routes: FastifyPluginAsync, options: { prefix: string }): Promise<() => void>;
};

type ActivationContext = { api: Api; dataDir?: string };

export async function activate({ api, dataDir }: ActivationContext) {
  const releaseHost = configurePackageRuntime({ ...api.runtime, dataDir });
  try {
    const releaseRoutes = await api.registerPrivilegedRoutes(createVirtualPhoneRoutes(), {
      prefix: "/api/virtual-phone",
    });
    return async () => {
      releaseRoutes();
      clearPageCache();
      releaseHost();
    };
  } catch (error) {
    releaseHost();
    throw error;
  }
}

/**
 * Runs at install time. Verifies the package's own invariants without needing a
 * model connection: every template's declared slots must exist in its markup,
 * and every template must belong to a real app.
 */
export async function selfCheck() {
  const appIds = new Set(PHONE_APPS.map((app) => app.id));
  for (const template of PHONE_TEMPLATES) {
    if (!appIds.has(template.appId)) {
      throw new Error(`Virtual Phone template ${template.id} targets unknown app ${template.appId}`);
    }
    const markup = extractSlots(template.html).sort();
    const declared = [...template.slots].sort();
    if (markup.join(",") !== declared.join(",")) {
      throw new Error(
        `Virtual Phone template ${template.id} declares slots [${declared}] but its markup has [${markup}]`,
      );
    }
  }
  return { ok: true, apps: PHONE_APPS.length, templates: PHONE_TEMPLATES.length };
}
