import type { ComponentType, LazyExoticComponent } from "react";
import { validateAppManifest, type AppManifest } from "./app-manifest";
import type { Phone } from "../system/PhonesSettings";
import type { DeviceSettings } from "../device/settings";

/**
 * Everything the device shell needs to render an app. Adding an app means adding one entry
 * here and nothing else — previously it meant editing seven places in index.tsx.
 */
export interface AppRenderContext {
  phone: Phone;
  chatId: string | null;
  settings: DeviceSettings;
  pendingSearch: string;
  setPendingSearch: (query: string) => void;
  onPhoneChange: (phone: Phone) => void;
  openApp: (appId: string) => void;
  installedApps: Array<{ manifest: AppManifest; installed: boolean }>;
  onInstalledChange: (appId: string, installed: boolean) => void;
}

export interface InstalledApp {
  manifest: AppManifest;
  // Props are supplied by `props()` below, so the component's own prop type is unconstrained here.
  component: LazyExoticComponent<ComponentType<any>>;
  /** Apps that render nothing useful without a chat — the shell hides them when there is none. */
  requiresChat?: boolean;
  /** False for Settings, which is reached by the gear button rather than a home-screen icon. */
  launcher?: boolean;
  /** App-specific props. `onBack` and `onClose` are supplied by the shell for every app. */
  props: (context: AppRenderContext) => Record<string, unknown>;
}

export class InstalledAppRegistry {
  private readonly apps = new Map<string, InstalledApp>();

  register(app: InstalledApp) {
    const manifest = validateAppManifest(app.manifest);
    if (this.apps.has(manifest.id)) throw new Error(`App ${manifest.id} is already registered`);
    this.apps.set(manifest.id, { ...app, manifest });
  }

  get(appId: string) {
    return this.apps.get(appId);
  }

  list() {
    return [...this.apps.values()];
  }
}
