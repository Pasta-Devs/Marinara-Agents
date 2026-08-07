import { randomUUID } from "node:crypto";
import type { PhoneDocumentRecord, PhoneDocumentStore } from "../device/identity";

const PACKAGE_ID = "virtual-phone";
const THREAD_KIND = "message-thread";
const MAX_TEXT = 2000;
const MAX_MESSAGES = 200;

export interface ThreadMessage {
  id: string;
  from: string;
  text: string;
  at: string;
}

/**
 * A character's reply is generated in the background so sending never blocks on the model.
 * `pending` is set when generation starts and cleared by the reply landing (or by the character
 * deliberately leaving the message on read); `failed` keeps the error visible in the thread
 * instead of letting it vanish.
 */
export interface ThreadReplyState {
  status: "pending" | "failed";
  at: string;
  error?: string;
}

export interface ThreadDocument {
  schemaVersion: 1;
  participants: [string, string];
  messages: ThreadMessage[];
  lastRead: Record<string, string>;
  reply?: ThreadReplyState;
}

function isThreadDocument(value: unknown): value is ThreadDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const document = value as Partial<ThreadDocument>;
  return (
    document.schemaVersion === 1 &&
    Array.isArray(document.participants) &&
    document.participants.length === 2 &&
    document.participants.every((participant) => typeof participant === "string") &&
    Array.isArray(document.messages) &&
    !!document.lastRead && typeof document.lastRead === "object" && !Array.isArray(document.lastRead)
  );
}

function parseThreadRecord(record: PhoneDocumentRecord) {
  if (!isThreadDocument(record.data)) throw new Error(`Thread record ${record.id} is invalid`);
  return { record, document: record.data };
}

export function unreadMessages(document: ThreadDocument, phoneId: string) {
  const lastRead = document.lastRead[phoneId] ?? "";
  return document.messages.filter((message) => message.from !== phoneId && message.at > lastRead);
}

export function unreadCount(document: ThreadDocument, phoneId: string) {
  return unreadMessages(document, phoneId).length;
}

export class PhoneMessagingService {
  constructor(
    private readonly documents: PhoneDocumentStore,
    private readonly now = () => new Date().toISOString(),
    private readonly createId = () => randomUUID(),
  ) {}

  private async listThreads() {
    return (await this.documents.list(PACKAGE_ID, THREAD_KIND)).map(parseThreadRecord);
  }

  async threadsFor(phoneId: string) {
    return (await this.listThreads())
      .filter(({ document }) => document.participants.includes(phoneId))
      .sort((a, b) => (b.document.messages.at(-1)?.at ?? "").localeCompare(a.document.messages.at(-1)?.at ?? ""));
  }

  async send(fromPhoneId: string, toPhoneId: string, rawText: string) {
    const text = typeof rawText === "string" ? rawText.trim() : "";
    if (!text) throw new Error("Message text is required");
    if (text.length > MAX_TEXT) throw new Error(`Messages are limited to ${MAX_TEXT} characters`);
    if (!fromPhoneId || !toPhoneId || fromPhoneId === toPhoneId) throw new Error("A message needs two different phones");
    const participants = [fromPhoneId, toPhoneId].sort() as [string, string];
    const at = this.now();
    const message: ThreadMessage = { id: this.createId(), from: fromPhoneId, text, at };
    const existing = (await this.listThreads()).find(
      ({ document }) => document.participants[0] === participants[0] && document.participants[1] === participants[1],
    );
    if (!existing) {
      const document: ThreadDocument = {
        schemaVersion: 1,
        participants,
        messages: [message],
        lastRead: { [fromPhoneId]: at },
      };
      const record = await this.documents.create({
        id: `thread:${participants[0]}:${participants[1]}`,
        packageId: PACKAGE_ID,
        kind: THREAD_KIND,
        name: participants.join(" & "),
        description: "Messages thread",
        data: document,
        createdAt: at,
        updatedAt: at,
      });
      return parseThreadRecord(record);
    }
    const document: ThreadDocument = {
      ...existing.document,
      messages: [...existing.document.messages, message].slice(-MAX_MESSAGES),
      lastRead: { ...existing.document.lastRead, [fromPhoneId]: at },
      // Any message landing settles the previous turn's reply state.
      reply: undefined,
    };
    const updated = await this.documents.update({
      id: existing.record.id,
      packageId: PACKAGE_ID,
      expectedRevision: existing.record.revision,
      name: existing.record.name,
      description: existing.record.description,
      data: document,
      updatedAt: at,
    });
    if (!updated) return this.send(fromPhoneId, toPhoneId, rawText);
    return parseThreadRecord(updated);
  }

  async setReplyState(threadId: string, reply: ThreadReplyState | null) {
    const thread = (await this.listThreads()).find(({ record }) => record.id === threadId);
    if (!thread) throw new Error("Thread not found");
    const document: ThreadDocument = { ...thread.document, reply: reply ?? undefined };
    const updated = await this.documents.update({
      id: thread.record.id,
      packageId: PACKAGE_ID,
      expectedRevision: thread.record.revision,
      name: thread.record.name,
      description: thread.record.description,
      data: document,
      updatedAt: this.now(),
    });
    if (!updated) return this.setReplyState(threadId, reply);
    return parseThreadRecord(updated);
  }

  async markRead(threadId: string, phoneId: string) {
    const thread = (await this.listThreads()).find(({ record }) => record.id === threadId);
    if (!thread || !thread.document.participants.includes(phoneId)) throw new Error("Thread not found");
    if (unreadCount(thread.document, phoneId) === 0) return thread;
    const document: ThreadDocument = {
      ...thread.document,
      lastRead: { ...thread.document.lastRead, [phoneId]: this.now() },
    };
    const updated = await this.documents.update({
      id: thread.record.id,
      packageId: PACKAGE_ID,
      expectedRevision: thread.record.revision,
      name: thread.record.name,
      description: thread.record.description,
      data: document,
      updatedAt: document.lastRead[phoneId]!,
    });
    if (!updated) return this.markRead(threadId, phoneId);
    return parseThreadRecord(updated);
  }
}
