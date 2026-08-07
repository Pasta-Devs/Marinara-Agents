import type { AppManifest } from "../../platform/app-manifest";

export const cameraManifest: AppManifest = {
  id: "camera",
  name: "Camera",
  version: "1.0.0",
  icon: "camera",
  category: "media",
  capabilities: ["storage.local", "context.read"],
  modelUse: "light",
  removable: true,
  routes: [{ id: "viewfinder", path: "/", title: "Camera" }],
  records: [{ type: "described-shot", ownership: "phone-local" }],
  actions: [{ id: "shoot", tier: "local", immediate: true }],
  content: { viewfinder: { fields: { photo: "string" } } },
  notifications: null,
};
