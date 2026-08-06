import type { AppManifest, AppModuleLoader } from "./app-manifest";

export type AppLifecycleState = "available" | "installed" | "active" | "disabled" | "failed";

export interface AppRecord {
  manifest: AppManifest;
  load: AppModuleLoader;
  state: AppLifecycleState;
  installedVersion: string | null;
}

export class AppLifecycleManager {
  private readonly records = new Map<string, AppRecord>();

  registerAvailable(manifest: AppManifest, load: AppModuleLoader) {
    if (this.records.has(manifest.id)) throw new Error(`App ${manifest.id} is already available`);
    this.records.set(manifest.id, { manifest, load, state: "available", installedVersion: null });
  }

  install(appId: string) {
    const record = this.require(appId);
    if (record.state === "active" || record.state === "installed") return record;
    record.state = "installed";
    record.installedVersion = record.manifest.version;
    return record;
  }

  disable(appId: string) {
    const record = this.require(appId);
    if (record.state === "available") throw new Error(`App ${appId} is not installed`);
    record.state = "disabled";
    return record;
  }

  remove(appId: string) {
    const record = this.require(appId);
    if (!record.manifest.removable) throw new Error(`App ${appId} cannot be removed`);
    this.records.delete(appId);
  }

  update(appId: string, manifest: AppManifest, migrate?: (fromVersion: string, toVersion: string) => Promise<void>) {
    const record = this.require(appId);
    if (record.installedVersion && record.installedVersion !== manifest.version) {
      const previousVersion = record.installedVersion;
      record.manifest = manifest;
      record.installedVersion = manifest.version;
      return Promise.resolve(migrate?.(previousVersion, manifest.version)).then(() => record);
    }
    return Promise.resolve(record);
  }

  async activate(appId: string) {
    const record = this.require(appId);
    if (record.state === "available") this.install(appId);
    if (record.state === "disabled") throw new Error(`App ${appId} is disabled`);
    try {
      await record.load();
      record.state = "active";
    } catch (error) {
      record.state = "failed";
      throw error;
    }
    return record;
  }

  get(appId: string) {
    return this.records.get(appId) ?? null;
  }

  private require(appId: string) {
    const record = this.records.get(appId);
    if (!record) throw new Error(`App ${appId} is unavailable`);
    return record;
  }
}

export interface AppRouteStack {
  appId: string;
  routes: string[];
}

export class AppRouteStackManager {
  private readonly stacks = new Map<string, AppRouteStack>();

  open(appId: string, rootRoute: string) {
    const stack = this.stacks.get(appId) ?? { appId, routes: [rootRoute] };
    this.stacks.set(appId, stack);
    return stack.routes[stack.routes.length - 1]!;
  }

  push(appId: string, route: string) {
    const stack = this.stacks.get(appId);
    if (!stack) throw new Error(`App ${appId} is not open`);
    stack.routes.push(route);
    return route;
  }

  back(appId: string): string | "home" {
    const stack = this.stacks.get(appId);
    if (!stack) return "home";
    if (stack.routes.length > 1) {
      stack.routes.pop();
      return stack.routes[stack.routes.length - 1]!;
    }
    this.stacks.delete(appId);
    return "home";
  }

  snapshot(appId: string) {
    return [...(this.stacks.get(appId)?.routes ?? [])];
  }
}
