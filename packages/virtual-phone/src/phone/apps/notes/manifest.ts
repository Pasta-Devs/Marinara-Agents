import type { AppManifest } from "../../platform/app-manifest";

export const notesManifest: AppManifest = {
  id: "notes",
  name: "Notes",
  version: "1.0.0",
  icon: "notes",
  category: "productivity",
  capabilities: ["storage.local"],
  modelUse: "none",
  removable: true,
  routes: [
    { id: "list", path: "/", title: "Notes" },
    { id: "note", path: "/note", title: "Note" },
  ],
  records: [{ type: "note", ownership: "phone-local" }],
  actions: [{ id: "save-note", tier: "local", immediate: true }],
  content: { list: {}, note: {} },
  notifications: null,
};
