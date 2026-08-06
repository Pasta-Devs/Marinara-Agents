import type { AppManifest } from "../../platform/app-manifest";

export const appStoreManifest: AppManifest = {
  id: "app-store",
  name: "App Store",
  version: "1.0.0",
  icon: "store",
  category: "system",
  capabilities: ["storage.local"],
  modelUse: "none",
  removable: false,
  routes: [
    { id: "root", path: "/", title: "App Store" },
    { id: "detail", path: "/apps/:appId", title: "App details" },
  ],
  records: [],
  actions: [
    { id: "install-app", tier: "local", immediate: true },
    { id: "remove-app", tier: "local", immediate: false },
  ],
  content: { root: {}, detail: {} },
  notifications: null,
};

export function modelUseLabel(modelUse: AppManifest["modelUse"]) {
  if (modelUse === "none") return "Works without a model";
  if (modelUse === "light") return "Uses the model lightly";
  return "Model-heavy";
}
