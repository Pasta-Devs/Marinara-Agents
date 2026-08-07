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

export interface MailItem {
  text: string;
  read: boolean;
}

/**
 * Refresh used to replace the inbox outright, destroying read state and every older mail.
 * New mail goes on top; anything already held keeps its position and its read flag. Identity is
 * the generated line itself — the model reproducing an identical mail is the same mail.
 */
export function mergeInbox(held: MailItem[], incoming: string[]): MailItem[] {
  const seen = new Set(held.map((item) => item.text));
  return [...incoming.filter((text) => !seen.has(text)).map((text) => ({ text, read: false })), ...held];
}
