import { validateAppManifest, type AppManifest, type AppModuleLoader } from "./app-manifest";

export interface InstalledApp {
  manifest: AppManifest;
  load: AppModuleLoader;
}

export type AppLaunchState =
  | { status: "idle" }
  | { status: "loading"; appId: string }
  | { status: "active"; appId: string; module: unknown }
  | { status: "failed"; appId: string; error: string };

export class InstalledAppRegistry {
  private readonly apps = new Map<string, InstalledApp>();

  register(app: InstalledApp) {
    const manifest = validateAppManifest(app.manifest);
    if (this.apps.has(manifest.id)) throw new Error(`App ${manifest.id} is already registered`);
    this.apps.set(manifest.id, { ...app, manifest });
  }

  list() {
    return [...this.apps.values()];
  }

  async launch(appId: string, onChange: (state: AppLaunchState) => void): Promise<AppLaunchState> {
    const app = this.apps.get(appId);
    if (!app) {
      const failed: AppLaunchState = { status: "failed", appId, error: "App is not installed" };
      onChange(failed);
      return failed;
    }
    onChange({ status: "loading", appId });
    try {
      const module = await app.load();
      const active: AppLaunchState = { status: "active", appId, module };
      onChange(active);
      return active;
    } catch (error) {
      const failed: AppLaunchState = {
        status: "failed",
        appId,
        error: error instanceof Error ? error.message : "App failed to load",
      };
      onChange(failed);
      return failed;
    }
  }
}
