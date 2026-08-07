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
