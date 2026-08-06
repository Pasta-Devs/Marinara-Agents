import type { AppManifest } from "../../platform/app-manifest";

export const messagesManifest: AppManifest = {
  id: "messages",
  name: "Messages",
  version: "1.0.0",
  icon: "messages",
  category: "communication",
  capabilities: ["storage.local", "notify", "participants"],
  modelUse: "light",
  removable: true,
  routes: [
    { id: "threads", path: "/", title: "Messages" },
    { id: "thread", path: "/thread", title: "Conversation" },
  ],
  records: [{ type: "message-thread", ownership: "participant-shared" }],
  actions: [{ id: "send-message", tier: "participant", immediate: true }],
  content: { threads: {}, thread: {} },
  notifications: { tier: "participant", dedupeBy: "thread" },
};
