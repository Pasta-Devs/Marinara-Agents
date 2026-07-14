// ──────────────────────────────────────────────
// Claude Agent SDK SessionStore adapter for the resume path
// ──────────────────────────────────────────────
//
// The Agent SDK's `resume` option, paired with a `sessionStore`, lets a caller
// inject prior conversation turns without touching the filesystem: the SDK
// calls `sessionStore.load()` once before it spawns the Claude Code
// subprocess, materializes the returned entries to its own temp JSONL, and
// resumes the subprocess from there. Marinara uses this to feed its
// `ChatMessage[]` history to the model as real multi-turn context (so prompt
// caching holds across turns) instead of folding it into one string prompt.
//
// This replaces the previous hand-rolled approach that wrote a synthetic JSONL
// into `~/.claude/projects/<cwd-as-dashes>/` and reaped it afterwards. Letting
// the SDK own the filesystem removes the cwd→project-dir path math (which
// never had a verified Windows form), the boot-time orphan sweep, and the
// read-only-mount fallback — and works identically on every platform.

import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import type { SessionKey, SessionStore, SessionStoreEntry } from "@anthropic-ai/claude-agent-sdk";
import { getDataDir } from "../../../../config/runtime-config.js";

/**
 * One-shot in-process `SessionStore` holding the synthetic history for a
 * single `query()` call.
 *
 * `load()` matches on `sessionId` alone and ignores `key.projectKey`: the
 * provider mints a fresh UUID per request and passes it as both this store's
 * key and the SDK's `resume` value, so the sessionId is already unique. That
 * is what frees the provider from having to replicate the SDK's private
 * cwd→projectKey encoding — the lever the previous filesystem approach got
 * wrong on Windows.
 *
 * `append()` is a required part of the `SessionStore` contract but is
 * intentionally a no-op: Marinara persists chat history in its own database
 * and has no use for the SDK's transcript-mirror feature.
 */
export class ResumeSessionStore implements SessionStore {
  readonly #sessionId: string;
  readonly #entries: SessionStoreEntry[];

  constructor(sessionId: string, entries: SessionStoreEntry[]) {
    this.#sessionId = sessionId;
    this.#entries = entries;
  }

  load(key: SessionKey): Promise<SessionStoreEntry[] | null> {
    return Promise.resolve(key.sessionId === this.#sessionId ? this.#entries : null);
  }

  append(_key: SessionKey, _entries: SessionStoreEntry[]): Promise<void> {
    return Promise.resolve();
  }
}

// Caches the resolved scratch-dir path. `mkdirSync` still runs on every
// `resumeScratchCwd()` call (a cheap near-no-op once the dir exists) so a
// directory pruned after process start is recreated rather than handed back
// as a dead `cwd`.
let cachedScratchCwd: string | null = null;

/**
 * A Marinara-owned working directory for `claude_subscription` resume calls.
 *
 * The SDK still writes each live turn's transcript to a real Claude Code
 * session file under `~/.claude/projects/<projectKey-of-cwd>/` — this is
 * unavoidable, `sessionStore` cannot be combined with `persistSession: false`.
 * Pointing `cwd` at this dedicated scratch directory keeps those files in
 * their own project bucket instead of intermingling with the user's real
 * `claude` CLI sessions for the Marinara repo. They are reaped by Claude
 * Code's own `cleanupPeriodDays` setting.
 *
 * Throws if the directory cannot be created (read-only / permission-locked
 * data dir); the provider catches that and degrades to the transcript-fold
 * path for the request.
 */
export function resumeScratchCwd(): string {
  const dir = cachedScratchCwd ?? resolve(getDataDir(), "claude-subscription-scratch");
  mkdirSync(dir, { recursive: true });
  cachedScratchCwd = dir;
  return dir;
}
