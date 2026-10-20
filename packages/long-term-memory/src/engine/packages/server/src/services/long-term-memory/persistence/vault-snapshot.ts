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

/**
 * Drop the parsed vault snapshot, and the verified recall index derived from it, for a root so the
 * next read rebuilds them from disk. Every vault mutation and repair already calls this.
 */
export function invalidateLtmVaultSnapshot(root: string) {
  snapshots.delete(resolve(root));
  verifiedIndexes.delete(resolve(root));
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
