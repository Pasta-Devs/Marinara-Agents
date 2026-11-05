import { resolve } from "node:path";
import type { LtmNote } from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import type { LtmRecallIndex } from "../recall/rebuild.js";

/**
 * One shared vault scan: parsed notes plus the failures the scan tolerated. `invalidNote` marks a
 * file that was read but is not a valid note; other failures (folder listing, file I/O) are not
 * content problems and must still surface.
 */
export interface LtmVaultScan {
  notes: LtmNote[];
  errors: { folder: string; error: unknown; invalidNote?: boolean }[];
}

const snapshots = new Map<string, Promise<LtmVaultScan>>();

/**
 * A parsed recall index that was verified fresh against the vault, with what it was verified at.
 * It is reusable only while the index state revision, the `recall.json` file identity and the
 * effective stop words still match.
 */
export interface LtmVerifiedRecallIndex {
  index: LtmRecallIndex;
  revision: number;
  fileKey: string;
  stopWordsKey: string;
}

const verifiedIndexes = new Map<string, LtmVerifiedRecallIndex>();

export function getVerifiedLtmRecallIndex(root: string) {
  return verifiedIndexes.get(resolve(root));
}

export function setVerifiedLtmRecallIndex(root: string, verified: LtmVerifiedRecallIndex) {
  verifiedIndexes.set(resolve(root), verified);
}

const writeWatchers = new Map<string, Set<(paths: readonly string[] | undefined) => void>>();

/**
 * Drop the parsed vault snapshot, and the verified recall index derived from it, for a root so the
 * next read rebuilds them from disk, and report the write to that root's write watchers. Every vault
 * mutation and repair already calls this; a mutation also names the root-relative paths it writes.
 */
export function invalidateLtmVaultSnapshot(root: string, paths?: readonly string[]) {
  snapshots.delete(resolve(root));
  verifiedIndexes.delete(resolve(root));
  for (const onWrite of writeWatchers.get(resolve(root)) ?? []) onWrite(paths);
}

/**
 * Report every later vault write for a root until the returned stop function runs: the root-relative paths a
 * mutation wrote, or undefined for a write that names none (recovery, repair, cleanup).
 */
export function watchLtmVaultWrites(root: string, onWrite: (paths: readonly string[] | undefined) => void) {
  const key = resolve(root);
  const watchers = writeWatchers.get(key) ?? new Set();
  writeWatchers.set(key, watchers.add(onWrite));
  return () => {
    watchers.delete(onWrite);
    // Only drop this set: after a repeated stop, the root may already hold another batch's watchers.
    if (!watchers.size && writeWatchers.get(key) === watchers) writeWatchers.delete(key);
  };
}

/**
 * Share one vault read/parse between consumers of the same root. The pending
 * promise is cached so concurrent readers join the same scan. A scan that
 * tolerated a bad note is not memoized, and a rejected scan drops its entry, so
 * a quarantine or external repair is picked up by the next read instead of
 * replaying a stale failure. Entries are only dropped while they are still the
 * cached one, so an invalidation that raced a newer load cannot evict that scan.
 */
export function readLtmVaultSnapshot(root: string, load: () => Promise<LtmVaultScan>) {
  const key = resolve(root);
  const cached = snapshots.get(key);
  if (cached) return cached;
  const pending = load().then(
    (scan) => {
      if (scan.errors.length && snapshots.get(key) === pending) snapshots.delete(key);
      return scan;
    },
    (error) => {
      if (snapshots.get(key) === pending) snapshots.delete(key);
      throw error;
    },
  );
  snapshots.set(key, pending);
  return pending;
}
