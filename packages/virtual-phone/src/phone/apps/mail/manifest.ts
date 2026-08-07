import type { AppManifest } from "../../platform/app-manifest";

export const mailManifest: AppManifest = {
  id: "mail",
  name: "Mail",
  version: "1.0.0",
  icon: "mail",
  category: "communication",
  capabilities: ["storage.local", "context.read"],
  modelUse: "heavy",
  removable: true,
  routes: [
    { id: "inbox", path: "/", title: "Mail" },
    { id: "message", path: "/message", title: "Message" },
  ],
  records: [{ type: "mail-cache", ownership: "phone-local" }],
  actions: [{ id: "refresh-inbox", tier: "ambient" }],
  content: { inbox: { fields: { emails: "string[]" } }, message: {} },
  notifications: null,
};

export function parseEmail(item: string) {
  const parts = item.split(" | ");
  return {
    from: parts[0]?.trim() || "Unknown sender",
    subject: parts[1]?.trim() || "(no subject)",
    body: parts.slice(2).join(" | ").trim() || "(empty message)",
  };
}
