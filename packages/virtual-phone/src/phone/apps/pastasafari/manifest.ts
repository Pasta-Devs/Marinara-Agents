import type { AppManifest } from "../../platform/app-manifest";

export const pastasafariManifest: AppManifest = {
  id: "pastasafari",
  name: "Pastasafari",
  version: "1.0.0",
  icon: "pastasafari",
  category: "games",
  capabilities: ["storage.local", "context.read", "story.write"],
  modelUse: "none",
  removable: true,
  routes: [{ id: "game", path: "/", title: "Pastasafari" }],
  records: [{ type: "game-progress", ownership: "phone-local" }],
  actions: [{ id: "play", tier: "local", immediate: true }, { id: "finish-level", tier: "story" }],
  content: { board: { fields: { tiles: "string[]", score: "number" } } },
  notifications: null,
};
