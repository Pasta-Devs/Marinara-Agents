import type { AppManifest } from "../../platform/app-manifest";

export const noodlerRManifest: AppManifest = {
  id: "noodler-r",
  name: "NoodleR",
  version: "1.0.0",
  icon: "noodler-r",
  category: "social",
  capabilities: ["storage.local", "context.read", "participants"],
  modelUse: "heavy",
  removable: true,
  routes: [
    { id: "creators", path: "/", title: "NoodleR" },
    { id: "page", path: "/page", title: "Creator page" },
  ],
  records: [{ type: "noodler-page", ownership: "story-shared" }],
  actions: [{ id: "subscribe", tier: "local", immediate: true }],
  content: { creators: {}, page: { fields: { tagline: "string", price: "string", posts: "string[]" } } },
  notifications: null,
};
