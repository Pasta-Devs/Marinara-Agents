import type { AppManifest } from "../../platform/app-manifest";

export const settingsManifest: AppManifest = {
  id: "settings",
  name: "Settings",
  version: "1.0.0",
  icon: "settings",
  category: "system",
  capabilities: ["storage.local"],
  modelUse: "none",
  removable: false,
  routes: [
    { id: "root", path: "/", title: "Settings" },
    { id: "device", path: "/device", title: "Device" },
    { id: "effects", path: "/effects", title: "Effects" },
    { id: "notifications", path: "/notifications", title: "Notifications" },
    { id: "privacy", path: "/privacy", title: "Privacy" },
    { id: "reset", path: "/reset", title: "Reset" },
  ],
  records: [],
  actions: [{ id: "reset-phone", tier: "local", immediate: false }],
  content: { root: {}, device: {}, effects: {}, notifications: {}, privacy: {}, reset: {} },
  notifications: null,
};
