import { randomUUID } from "node:crypto";
import type { PhoneDocumentRecord, PhoneDocumentStore } from "../device/identity";

const PACKAGE_ID = "virtual-phone";
const FEED_KIND = "noodle-feed";
const MAX_POSTS = 200;
const MAX_TEXT = 500;

export interface NoodlePost {
  id: string;
  author: string;
  handle: string;
  text: string;
  at: string;
}

export interface NoodleFeedDocument {
  schemaVersion: 1;
  chatId: string;
  posts: NoodlePost[];
}

function isFeedDocument(value: unknown): value is NoodleFeedDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const document = value as Partial<NoodleFeedDocument>;
  return document.schemaVersion === 1 && typeof document.chatId === "string" && Array.isArray(document.posts);
}

function parseFeedRecord(record: PhoneDocumentRecord) {
  if (!isFeedDocument(record.data)) throw new Error(`Noodle feed record ${record.id} is invalid`);
  return { record, document: record.data };
}

export function handleFor(name: string) {
  return `@${name.toLowerCase().replace(/[^a-z0-9]+/gu, "") || "noodler"}`;
}

export function parseGeneratedPost(item: string) {
  const [authorPart, ...rest] = item.split(" — ");
  const raw = rest.length ? authorPart!.trim() : "Noodle";
  const text = (rest.length ? rest.join(" — ") : item).trim().slice(0, MAX_TEXT);
  const handle = raw.match(/@[\w.-]+/u)?.[0] ?? handleFor(raw);
  const author = raw.replace(handle, "").trim() || handle.slice(1);
  return { author, handle, text };
}

const PAGE_KIND = "noodler-page";
const MAX_PAGE_POSTS = 12;

export interface NoodlerPagePost {
  id: string;
  text: string;
  locked: boolean;
}

export interface NoodlerPageDocument {
  schemaVersion: 1;
  chatId: string;
  creatorPhoneId: string;
  creatorName: string;
  tagline: string;
  price: string;
  posts: NoodlerPagePost[];
}

function isPageDocument(value: unknown): value is NoodlerPageDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const document = value as Partial<NoodlerPageDocument>;
  return document.schemaVersion === 1 && typeof document.chatId === "string" &&
    typeof document.creatorPhoneId === "string" && typeof document.creatorName === "string" &&
    Array.isArray(document.posts);
}

function parsePageRecord(record: PhoneDocumentRecord) {
  if (!isPageDocument(record.data)) throw new Error(`NoodleR page record ${record.id} is invalid`);
  return { record, document: record.data };
}

export function parsePagePost(item: string) {
  const parts = item.split(" | ");
  const marker = parts.at(-1)?.trim().toLowerCase();
  const locked = marker === "locked";
  const text = (marker === "locked" || marker === "free" ? parts.slice(0, -1).join(" | ") : item).trim().slice(0, MAX_TEXT);
  return { text, locked };
}

export class NoodlerPageService {
  constructor(
    private readonly documents: PhoneDocumentStore,
    private readonly now = () => new Date().toISOString(),
    private readonly createId = () => randomUUID(),
  ) {}

  private async listPages() {
    return (await this.documents.list(PACKAGE_ID, PAGE_KIND)).map(parsePageRecord);
  }

  async pageFor(chatId: string, creatorPhoneId: string) {
    return (await this.listPages())
      .find(({ document }) => document.chatId === chatId && document.creatorPhoneId === creatorPhoneId) ?? null;
  }

  async savePage(input: { chatId: string; creatorPhoneId: string; creatorName: string; tagline: string; price: string; posts: Array<{ text: string; locked: boolean }> }) {
    const document: NoodlerPageDocument = {
      schemaVersion: 1,
      chatId: input.chatId,
      creatorPhoneId: input.creatorPhoneId,
      creatorName: input.creatorName.trim().slice(0, 80) || "Creator",
      tagline: input.tagline.trim().slice(0, 200),
      price: input.price.trim().slice(0, 40),
      posts: input.posts
        .map((post) => ({ id: this.createId(), text: post.text.trim().slice(0, MAX_TEXT), locked: post.locked }))
        .filter((post) => post.text)
        .slice(0, MAX_PAGE_POSTS),
    };
    const at = this.now();
    const existing = await this.pageFor(input.chatId, input.creatorPhoneId);
    if (!existing) {
      const record = await this.documents.create({
        id: `noodler-page:${input.chatId}:${input.creatorPhoneId}`,
        packageId: PACKAGE_ID,
        kind: PAGE_KIND,
        name: `NoodleR ${input.creatorName}`,
        description: "Shared in-story NoodleR page",
        data: document,
        createdAt: at,
        updatedAt: at,
      });
      return parsePageRecord(record);
    }
    const updated = await this.documents.update({
      id: existing.record.id,
      packageId: PACKAGE_ID,
      expectedRevision: existing.record.revision,
      name: existing.record.name,
      description: existing.record.description,
      data: document,
      updatedAt: at,
    });
    if (!updated) return this.savePage(input);
    return parsePageRecord(updated);
  }
}

export class NoodleFeedService {
  constructor(
    private readonly documents: PhoneDocumentStore,
    private readonly now = () => new Date().toISOString(),
    private readonly createId = () => randomUUID(),
  ) {}

  private async listFeeds() {
    return (await this.documents.list(PACKAGE_ID, FEED_KIND)).map(parseFeedRecord);
  }

  async feedFor(chatIds: string[]) {
    const scope = new Set(chatIds);
    return (await this.listFeeds())
      .filter(({ document }) => scope.has(document.chatId))
      .flatMap(({ document }) => document.posts)
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 100);
  }

  async addPosts(chatId: string, posts: Array<{ author: string; handle: string; text: string }>) {
    const cleaned = posts
      .map((post) => ({
        author: post.author.trim().slice(0, 80) || "Someone",
        handle: post.handle.trim().slice(0, 40) || "@someone",
        text: post.text.trim().slice(0, MAX_TEXT),
      }))
      .filter((post) => post.text);
    if (!chatId || cleaned.length === 0) return this.feedFor([chatId]);
    const at = this.now();
    const stamped: NoodlePost[] = cleaned.map((post, index) => ({
      ...post,
      id: this.createId(),
      // Preserve batch order under a descending-sorted merge.
      at: new Date(Date.parse(at) - index).toISOString(),
    }));
    const existing = (await this.listFeeds()).find(({ document }) => document.chatId === chatId);
    if (!existing) {
      const document: NoodleFeedDocument = { schemaVersion: 1, chatId, posts: stamped };
      await this.documents.create({
        id: `noodle:${chatId}`,
        packageId: PACKAGE_ID,
        kind: FEED_KIND,
        name: `Noodle feed ${chatId}`,
        description: "Shared in-story Noodle timeline",
        data: document,
        createdAt: at,
        updatedAt: at,
      });
      return this.feedFor([chatId]);
    }
    const document: NoodleFeedDocument = {
      ...existing.document,
      posts: [...stamped, ...existing.document.posts].slice(0, MAX_POSTS),
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
    if (!updated) return this.addPosts(chatId, posts);
    return this.feedFor([chatId]);
  }
}
