import type { AppManifest } from "../../platform/app-manifest";

export const callsManifest: AppManifest = {
  id: "calls",
  name: "Phone",
  version: "1.0.0",
  icon: "phone",
  category: "communication",
  capabilities: ["context.read", "participants", "notify", "story.write"],
  modelUse: "none",
  removable: false,
  routes: [
    { id: "recents", path: "/", title: "Phone" },
    { id: "contacts", path: "/contacts", title: "Contacts" },
  ],
  records: [{ type: "call-session", ownership: "participant-shared" }],
  actions: [
    { id: "place-call", tier: "participant", immediate: true },
    { id: "decline-call", tier: "participant", immediate: true },
    { id: "end-call", tier: "participant", immediate: true },
  ],
  content: { recents: {}, contacts: {} },
  notifications: { tier: "participant", dedupeBy: "call-session" },
};
