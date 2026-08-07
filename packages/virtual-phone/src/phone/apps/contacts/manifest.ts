import type { AppManifest } from "../../platform/app-manifest";

export const contactsManifest: AppManifest = {
  id: "contacts",
  name: "Contacts",
  version: "1.0.0",
  icon: "contacts",
  category: "communication",
  capabilities: ["participants"],
  modelUse: "none",
  removable: true,
  routes: [{ id: "list", path: "/", title: "Contacts" }],
  records: [{ type: "contact", ownership: "permissioned-private" }],
  actions: [{ id: "add-contact", tier: "local", immediate: true }],
  content: { list: {} },
  notifications: null,
};
