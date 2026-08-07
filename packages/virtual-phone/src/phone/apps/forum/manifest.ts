import type { AppManifest } from "../../platform/app-manifest";

export const forumManifest: AppManifest = {
  id: "forum",
  name: "Forum",
  version: "1.0.0",
  icon: "forum",
  category: "communication",
  capabilities: ["storage.local", "context.read"],
  modelUse: "heavy",
  removable: true,
  routes: [
    { id: "board", path: "/", title: "Forum" },
    { id: "thread", path: "/thread", title: "Thread" },
  ],
  records: [{ type: "forum-thread", ownership: "story-shared" }],
  actions: [{ id: "reply", tier: "participant", immediate: true }],
  content: { board: { fields: { threads: "string[]" } }, thread: { fields: { replies: "string[]" } } },
  notifications: null,
};
