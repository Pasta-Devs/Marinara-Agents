import type { AppManifest } from "../../platform/app-manifest";

export const gameManifest: AppManifest = {
  id: "game",
  name: "Game",
  version: "1.0.0",
  icon: "game",
  category: "games",
  capabilities: ["storage.local"],
  modelUse: "none",
  removable: true,
  routes: [{ id: "game", path: "/", title: "Game" }],
  records: [{ type: "game-progress", ownership: "phone-local" }],
  actions: [{ id: "play", tier: "local", immediate: true }],
  content: { board: { fields: { tiles: "string[]", score: "number", best: "number", moves: "number", gamesPlayed: "number" } } },
  notifications: null,
};
