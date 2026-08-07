import { randomUUID } from "node:crypto";
import type { PhoneDocumentRecord, PhoneDocumentStore } from "../device/identity";

const PACKAGE_ID = "virtual-phone";
const BOARD_KIND = "forum-board";
const MAX_THREADS = 30;
const MAX_POSTS = 40;
const MAX_TEXT = 1000;

export interface ForumPost {
  id: string;
  author: string;
  text: string;
  at: string;
}

export interface ForumThread {
  id: string;
  title: string;
  author: string;
  at: string;
  posts: ForumPost[];
}

export interface ForumBoardDocument {
  schemaVersion: 1;
  chatId: string;
  threads: ForumThread[];
}

function isBoardDocument(value: unknown): value is ForumBoardDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const document = value as Partial<ForumBoardDocument>;
  return document.schemaVersion === 1 && typeof document.chatId === "string" && Array.isArray(document.threads);
}

function parseBoardRecord(record: PhoneDocumentRecord) {
  if (!isBoardDocument(record.data)) throw new Error(`Forum board record ${record.id} is invalid`);
  return { record, document: record.data };
}

export function parseGeneratedThread(item: string) {
  const [title, author, ...rest] = item.split(" | ");
  return {
    title: title?.trim().slice(0, 160) || "Untitled thread",
    author: author?.trim().slice(0, 80) || "Anonymous",
    body: rest.join(" | ").trim().slice(0, MAX_TEXT) || "…",
  };
}

export function parseGeneratedReply(item: string) {
  const [author, ...rest] = item.split(" | ");
  return {
    author: author?.trim().slice(0, 80) || "Anonymous",
    text: rest.join(" | ").trim().slice(0, MAX_TEXT),
  };
}

function lastActivity(thread: ForumThread) {
  return thread.posts.at(-1)?.at ?? thread.at;
}

export class ForumService {
  constructor(
    private readonly documents: PhoneDocumentStore,
    private readonly now = () => new Date().toISOString(),
    private readonly createId = () => randomUUID(),
  ) {}

  private async listBoards() {
    return (await this.documents.list(PACKAGE_ID, BOARD_KIND)).map(parseBoardRecord);
  }

  async boardFor(chatIds: string[]) {
    const scope = new Set(chatIds);
    return (await this.listBoards())
      .filter(({ document }) => scope.has(document.chatId))
      .flatMap(({ document }) => document.threads)
      .sort((a, b) => lastActivity(b).localeCompare(lastActivity(a)))
      .slice(0, MAX_THREADS);
  }

  private async writeBoard(chatId: string, mutate: (threads: ForumThread[]) => ForumThread[]) {
    const at = this.now();
    const existing = (await this.listBoards()).find(({ document }) => document.chatId === chatId);
    if (!existing) {
      const document: ForumBoardDocument = { schemaVersion: 1, chatId, threads: mutate([]).slice(0, MAX_THREADS) };
      await this.documents.create({
        id: `forum:${chatId}`,
        packageId: PACKAGE_ID,
        kind: BOARD_KIND,
        name: `Forum board ${chatId}`,
        description: "Shared in-story forum board",
        data: document,
        createdAt: at,
        updatedAt: at,
      });
      return;
    }
    const document: ForumBoardDocument = {
      ...existing.document,
      threads: mutate(existing.document.threads).slice(0, MAX_THREADS),
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
    if (!updated) return this.writeBoard(chatId, mutate);
  }

  async addThreads(chatId: string, threads: Array<{ title: string; author: string; body: string }>) {
    const at = this.now();
    const stamped: ForumThread[] = threads
      .filter((thread) => thread.title.trim() && thread.body.trim())
      .map((thread, index) => ({
        id: this.createId(),
        title: thread.title.trim().slice(0, 160),
        author: thread.author.trim().slice(0, 80) || "Anonymous",
        at: new Date(Date.parse(at) - index).toISOString(),
        posts: [{ id: this.createId(), author: thread.author.trim().slice(0, 80) || "Anonymous", text: thread.body.trim().slice(0, MAX_TEXT), at: new Date(Date.parse(at) - index).toISOString() }],
      }));
    if (stamped.length) await this.writeBoard(chatId, (existing) => [...stamped, ...existing]);
  }

  async addReply(chatIds: string[], threadId: string, author: string, text: string) {
    const trimmed = text.trim().slice(0, MAX_TEXT);
    if (!trimmed) throw new Error("Reply text is required");
    const scope = new Set(chatIds);
    const owner = (await this.listBoards()).find(({ document }) =>
      scope.has(document.chatId) && document.threads.some((thread) => thread.id === threadId));
    if (!owner) throw new Error("Thread not found");
    const post: ForumPost = { id: this.createId(), author: author.trim().slice(0, 80) || "Anonymous", text: trimmed, at: this.now() };
    await this.writeBoard(owner.document.chatId, (threads) => threads.map((thread) =>
      thread.id === threadId ? { ...thread, posts: [...thread.posts, post].slice(-MAX_POSTS) } : thread));
    return owner.document.chatId;
  }
}
