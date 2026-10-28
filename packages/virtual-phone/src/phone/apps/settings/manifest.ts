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
    { id: "appearance", path: "/appearance", title: "Appearance" },
    { id: "home", path: "/home", title: "Home Screen" },
    { id: "state", path: "/state", title: "Phone State" },
    { id: "roleplay", path: "/roleplay", title: "Roleplay & AI" },
    { id: "about", path: "/about", title: "About" },
    { id: "reset", path: "/reset", title: "Reset" },
  ],
  records: [],
  actions: [{ id: "reset-phone", tier: "local", immediate: false }],
  content: { root: {}, appearance: {}, home: {}, state: {}, roleplay: {}, about: {}, reset: {} },
  notifications: null,
};
