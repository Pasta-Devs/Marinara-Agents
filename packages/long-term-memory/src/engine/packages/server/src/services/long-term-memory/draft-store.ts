import { randomUUID } from "node:crypto";
import { readdir, readFile, unlink } from "node:fs/promises";
import {
  isLtmSourceLikeNote,
  ltmDraftStatusSchema,
  ltmExtractionDraftSchema,
  type LtmExtractionDraft,
  type LtmDraftStatus,
  type LtmMode,
  type LtmScope,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { readJsonFile, writeJsonAtomic } from "./atomic-json.js";
import { isEnoent, nowIso } from "./ltm-utils.js";
import { getLongTermMemoryDirectories, getLongTermMemoryRoot, safeJoin } from "./paths.js";
import { extractionFingerprintForLtmSourceNote, sourceHashForLtmSourceNote } from "./source-hash.js";
import { LongTermMemoryStorage } from "./storage.js";
import { withLtmVaultLock } from "./vault-lock.js";

const locks = new Map<string, Promise<void>>();
async function withLock<T>(key: string, operation: () => Promise<T>) {
  const previous = locks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  const tail = previous.then(() => current, () => current);
  locks.set(key, tail);
  try { await previous.catch(() => {}); return await operation(); }
  finally { release(); if (locks.get(key) === tail) locks.delete(key); }
}

export class LongTermMemoryDraftStore {
  private storage: LongTermMemoryStorage;
  constructor(readonly root = getLongTermMemoryRoot()) { this.storage = new LongTermMemoryStorage(root); }
  private path(id: string) { return safeJoin(getLongTermMemoryDirectories(this.root).drafts, `${id}.json`); }
  async initialize() { await this.storage.initializeLtmStore(); }
  async withDraftLock<T>(id: string, operation: () => Promise<T>) { await this.initialize(); return withLtmVaultLock(this.root, () => withLock(this.path(id), operation)); }
  async listDrafts(filter: { status?: string; chatId?: string } = {}) {
    await this.initialize();
    const drafts: LtmExtractionDraft[] = [];
    for (const entry of await readdir(getLongTermMemoryDirectories(this.root).drafts, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      let raw: unknown;
      try { raw = JSON.parse(await readFile(safeJoin(getLongTermMemoryDirectories(this.root).drafts, entry.name), "utf8")); } catch { continue; }
      const parsed = ltmExtractionDraftSchema.safeParse(raw);
      if (!parsed.success || (filter.status && parsed.data.status !== filter.status) || (filter.chatId && parsed.data.source.chatId !== filter.chatId)) continue;
      drafts.push(parsed.data);
    }
    return drafts.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  }
  async getDraft(id: string) { await this.initialize(); return readJsonFile(this.path(id), null).then((value) => value ? ltmExtractionDraftSchema.parse(value) : null); }
  async createDraft(input: { sourceNoteId: string; chatId?: string; scope?: LtmScope; modes: LtmMode[]; summary?: string; mutations: LtmExtractionDraft["mutations"] }) {
    await this.initialize();
    const source = await this.storage.getNote(input.sourceNoteId);
    if (!source || !isLtmSourceLikeNote(source)) throw new Error(`Long-term memory draft source note not found: ${input.sourceNoteId}`);
    const timestamp = nowIso();
    const draft = ltmExtractionDraftSchema.parse({ id: randomUUID(), status: "pending", createdAt: timestamp, updatedAt: timestamp, operationId: randomUUID(), source: { sourceNoteId: source.id, chatId: input.chatId, sourceHash: sourceHashForLtmSourceNote(source), extractionFingerprint: extractionFingerprintForLtmSourceNote(source, { extractionMode: input.modes.find((mode) => source.modes.includes(mode)) ?? source.modes[0] }) }, scope: input.scope ?? source.scope, modes: input.modes, summary: input.summary ?? "", mutations: input.mutations });
    await writeJsonAtomic(this.path(draft.id), draft);
    return draft;
  }
  async updateDraftUnlocked(id: string, patch: Partial<Omit<LtmExtractionDraft, "id" | "createdAt" | "updatedAt">>) {
    const draft = await this.getDraft(id);
    if (!draft) return null;
    const next = ltmExtractionDraftSchema.parse({ ...draft, ...patch, id: draft.id, createdAt: draft.createdAt, updatedAt: nowIso() });
    await writeJsonAtomic(this.path(id), next);
    return next;
  }
  async updateDraft(id: string, patch: Partial<Omit<LtmExtractionDraft, "id" | "createdAt" | "updatedAt">>) { return this.withDraftLock(id, () => this.updateDraftUnlocked(id, patch)); }
  async updateDraftStatusUnlocked(id: string, status: LtmDraftStatus, patch: Partial<LtmExtractionDraft> = {}) { return this.updateDraftUnlocked(id, { ...patch, status: ltmDraftStatusSchema.parse(status) }); }
  async updateDraftStatus(id: string, status: string, patch: Partial<LtmExtractionDraft> = {}) { return this.withDraftLock(id, () => this.updateDraftStatusUnlocked(id, ltmDraftStatusSchema.parse(status), patch)); }
  async deleteDraftMutations(id: string, mutationIds: string[]) {
    return this.withDraftLock(id, async () => {
      const draft = await this.getDraft(id);
      if (!draft) return { draft: null, deleted: false as const, reason: "not_found" as const };
      if (draft.status !== "pending") return { draft, deleted: false as const, reason: "not_pending" as const };
      const wanted = new Set(mutationIds);
      if ([...wanted].some((mutationId) => !draft.mutations.some((mutation) => mutation.id === mutationId))) return { draft, deleted: false as const, reason: "not_found" as const };
      const mutations = draft.mutations.filter((mutation) => !wanted.has(mutation.id));
      if (mutations.length === 0) {
        await unlink(this.path(id));
        return { draft: null, deleted: true as const };
      }
      const next = await this.updateDraftUnlocked(id, { mutations });
      return { draft: next, deleted: true as const };
    });
  }
  async deleteDraft(id: string) {
    return this.withDraftLock(id, async () => { try { await unlink(this.path(id)); return true; } catch (error) { if (isEnoent(error)) return false; throw error; } });
  }
}
