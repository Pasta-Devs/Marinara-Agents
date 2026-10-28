import type { AppManifest } from "../../platform/app-manifest";

export const noodlerManifest: AppManifest = {
  id: "noodler",
  // ponytail: id stays "noodler" for installed-app continuity; display name matches the Engine's Noodle
  name: "Noodle",
  version: "1.0.0",
  icon: "noodler",
  category: "social",
  capabilities: ["storage.local", "context.read"],
  modelUse: "heavy",
  removable: true,
  routes: [{ id: "feed", path: "/", title: "Noodle" }],
  records: [
    { type: "noodle-feed", ownership: "story-shared" },
    { type: "saved-posts", ownership: "phone-local" },
  ],
  actions: [
    { id: "refresh-feed", tier: "ambient" },
    { id: "publish-post", tier: "story" },
    { id: "react-to-post", tier: "participant" },
  ],
  content: { feed: { fields: { posts: "string[]" } } },
  notifications: null,
};

export function fallbackFeed() {
  return { posts: [] as string[] };
}
