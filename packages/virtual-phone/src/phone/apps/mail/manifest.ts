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
    { id: "compose", path: "/compose", title: "Compose" },
  ],
  records: [{ type: "mail-cache", ownership: "phone-local" }],
  actions: [
    { id: "refresh-inbox", tier: "ambient" },
    { id: "compose", tier: "local" },
  ],
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

export type MailFolder = "inbox" | "sent" | "archive";

export interface MailMessage {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  at: string;
  read: boolean;
  folder: MailFolder;
  /** Ties a reply to what it answers, so a thread can be followed rather than guessed at. */
  replyTo?: string;
}

const newId = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `mail-${Math.random().toString(36).slice(2)}`);

/** Generated inbox lines are "Sender | Subject | body". */
export function mailFromLine(line: string, owner: string, at: string): MailMessage {
  const parsed = parseEmail(line);
  return {
    id: newId(),
    from: parsed.from,
    to: owner,
    subject: parsed.subject,
    body: parsed.body,
    at,
    read: false,
    folder: "inbox",
  };
}

export function draftMail(input: { from: string; to: string; subject: string; body: string; replyTo?: string }): MailMessage {
  return {
    id: newId(),
    from: input.from,
    to: input.to,
    subject: input.subject.trim() || "(no subject)",
    body: input.body,
    at: new Date().toISOString(),
    read: true,
    folder: "sent",
    ...(input.replyTo ? { replyTo: input.replyTo } : {}),
  };
}

/**
 * Refresh appends. It used to replace the whole mailbox, destroying read state, sent mail and every
 * older message. Identity is sender plus subject plus body — the model reproducing an identical
 * mail is the same mail.
 */
export function mergeMail(held: MailMessage[], incoming: MailMessage[]): MailMessage[] {
  const key = (mail: MailMessage) => `${mail.from}\u0000${mail.subject}\u0000${mail.body}`;
  const seen = new Set(held.map(key));
  return [...incoming.filter((mail) => !seen.has(key(mail))), ...held];
}

/**
 * Anything stored by an earlier build, which kept `{ text, read }` with the raw generated line.
 * Dropping it would delete people's mailboxes on update.
 */
export function readStoredMail(value: unknown, owner: string): MailMessage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Partial<MailMessage> & { text?: unknown };
    if (typeof record.id === "string" && typeof record.body === "string") return [record as MailMessage];
    if (typeof record.text !== "string") return [];
    const migrated = mailFromLine(record.text, owner, new Date().toISOString());
    return [{ ...migrated, read: record.read === true }];
  });
}
