import type { AppManifest } from "../../platform/app-manifest";

export const noodlerManifest: AppManifest = {
  id: "noodler",
  name: "Noodler",
  version: "1.0.0",
  icon: "noodler",
  category: "social",
  capabilities: ["storage.local", "context.read"],
  modelUse: "heavy",
  removable: true,
  routes: [{ id: "feed", path: "/", title: "Noodler" }],
  records: [{ type: "feed-cache", ownership: "phone-local" }],
  actions: [{ id: "refresh-feed", tier: "ambient" }],
  content: { feed: { fields: { posts: "string[]" } } },
  notifications: null,
};

export function fallbackFeed() {
  return { posts: [] as string[] };
}
