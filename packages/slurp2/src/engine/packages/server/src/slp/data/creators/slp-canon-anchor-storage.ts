/**
 * The stored card reading (canon anchors), one entry per Creator: what a model once took from the
 * card, with the player's own corrections on top.
 *
 * The model call is passed in (`read`), so this file only decides when a card is read and what is
 * kept: one reading per card text, the player's edits carried into every new reading, and nothing
 * written when the store could not be read. See `mergeSlurpCanonAnchors` for what an edit is.
 */
import { createHash } from "node:crypto";
import type { DB } from "../../../db/connection.js";
import { logger } from "../../../lib/logger.js";
import { slpIsAdmissionFailure } from "../../base/host/slp-admission.js";
import { createAppSettingsStorage } from "../../../services/storage/app-settings.storage.js";
import type { SlurpCanonAnchors } from "../../modules/feed/slp-post-beat.js";
import { mergeSlurpCanonAnchors, normalizeSlurpCanonAnchors } from "../../modules/feed/slp-post-brief.js";

/** One JSON blob in app settings. `slp-flavour-source.ts` reads it for the brief, stale or not. */
export const SLURP_CANON_ANCHORS_KEY = "slurp2.canon-anchors";

// Bumped when the extraction asks for more (v2 added the routine, v3 the essentials and the wider
// card text), so every cache refreshes once. The player's edits are merged into the new reading.
const ANCHORS_VERSION = "v3";
const anchorKey = (text: string) => createHash("sha256").update(`${ANCHORS_VERSION}:${text}`).digest("hex");
const FAILED_WAIT_MS = 30 * 60_000;

/**
 * Keyed by a hash of the card text the reading sees, so a card edit re-extracts. `anchors` is what
 * is in use. On an entry the player edited, `extracted` is the reading they edited, which is what
 * tells their edits from the card's own facts when the card is read again; it is missing on edits
 * stored before 0.3.26.
 */
type AnchorEntry = {
  key: string;
  anchors: SlurpCanonAnchors | null;
  edited?: boolean;
  extracted?: SlurpCanonAnchors | null;
};
type AnchorCache = Record<string, AnchorEntry>;

// ponytail: one JSON blob in app settings, rewritten per extraction, and in-memory in-flight and
// failure maps that reset on restart. A table per Creator if installs grow past a few hundred.
const inFlight = new Set<string>();
const failedUntil = new Map<string, number>();
let writeQueue: Promise<unknown> = Promise.resolve();

function parseAnchorCache(raw: unknown): AnchorCache {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as AnchorCache) : {};
  } catch {
    return {};
  }
}

async function readAnchorCache(db: DB): Promise<AnchorCache> {
  try {
    return parseAnchorCache(await createAppSettingsStorage(db).get(SLURP_CANON_ANCHORS_KEY));
  } catch {
    return {};
  }
}

/**
 * Change one Creator's entry: `change` gets what is stored and returns the new entry, `null` to
 * remove it, or `undefined` to leave it. One at a time, so an edit and a background reading never
 * overwrite each other. A store that cannot be read is not written: the blob holds every Creator's
 * entry, and writing one entry over a failed read would erase the others. Rejects on failure.
 */
function updateAnchors(
  db: DB,
  accountId: string,
  change: (stored: AnchorEntry | undefined) => AnchorEntry | null | undefined,
): Promise<void> {
  const run = writeQueue.then(async () => {
    const settings = createAppSettingsStorage(db);
    const cache = parseAnchorCache(await settings.get(SLURP_CANON_ANCHORS_KEY));
    const entry = change(cache[accountId]);
    if (entry === undefined) return;
    if (entry) cache[accountId] = entry;
    else delete cache[accountId];
    await settings.set(SLURP_CANON_ANCHORS_KEY, JSON.stringify(cache));
  });
  writeQueue = run.catch(() => undefined);
  return run;
}

/** One reading, stored. Never awaited by a post. */
async function storeReading(
  db: DB,
  accountId: string,
  key: string,
  read: () => Promise<SlurpCanonAnchors | null>,
): Promise<void> {
  const fresh = await read();
  // A reading always answers the essentials: none is an answer, where a missing list means "not read".
  if (fresh) fresh.essentials ??= [];
  await updateAnchors(db, accountId, (stored) => {
    // A card with nothing concrete is stored too, so it is not re-read before every post.
    if (!stored?.edited) return { key, anchors: fresh };
    if (stored.key === key) return undefined;
    // The card or the reading changed under the player's edits: their edits ride on the new reading.
    return {
      key,
      anchors: mergeSlurpCanonAnchors(stored.anchors, stored.extracted, fresh),
      edited: true,
      extracted: fresh,
    };
  });
}

/**
 * This Creator's anchors for the card text `text`, or null when the card was never read. A missing
 * or stale entry starts one background reading; the caller never waits on a model and gets what is
 * stored meanwhile (the last reading, or the player's own anchors). A failed reading is not tried
 * again for half an hour and leaves what is stored as it is, so a model that cannot read this card
 * never takes away anchors that exist.
 */
export async function slurpCanonAnchorsFor(
  db: DB,
  accountId: string,
  text: string,
  at: Date,
  read: () => Promise<SlurpCanonAnchors | null>,
): Promise<SlurpCanonAnchors | null> {
  const cached = (await readAnchorCache(db))[accountId];
  // No card text (no card, or it could not be read just now): what is stored, and no reading.
  if (!text.trim()) return cached?.anchors ?? null;
  const key = anchorKey(text);
  if (cached?.key === key) return cached.anchors;
  if (!inFlight.has(accountId) && (failedUntil.get(accountId) ?? 0) <= at.getTime()) {
    inFlight.add(accountId);
    void storeReading(db, accountId, key, read)
      .then(() => failedUntil.delete(accountId))
      .catch((error: unknown) => {
        // A busy connection sent nothing: the next post tries again.
        if (slpIsAdmissionFailure(error)) return;
        failedUntil.set(accountId, at.getTime() + FAILED_WAIT_MS);
        logger.warn(error, "[slurp] Canon anchor extraction failed; posts stay on the classic planner for now");
      })
      .finally(() => inFlight.delete(accountId));
  }
  return cached?.anchors ?? null;
}

/**
 * The anchors a Creator's editor shows: what is stored, whether the player edited it, and whether
 * it still belongs to the current card. A card edit makes an entry stale; the next post then reads
 * the card again, and the player's edits are carried into the new reading. `text` is the card as
 * the reading sees it (`SLP_CANON_READING_SCALE`).
 */
export async function readSlurpCanonAnchorState(
  db: DB,
  accountId: string,
  text: string,
): Promise<{ anchors: SlurpCanonAnchors | null; edited: boolean; current: boolean; read: boolean }> {
  const cached = (await readAnchorCache(db))[accountId];
  return {
    anchors: cached?.anchors ?? null,
    edited: cached?.edited === true,
    current: Boolean(cached) && cached!.key === anchorKey(text),
    read: Boolean(cached),
  };
}

/**
 * Store the player's own anchors. The entry keeps its card key, so a card that changed is still
 * read again, and the reading the player started from, so that reading can tell what they changed.
 */
export async function saveSlurpCanonAnchors(
  db: DB,
  accountId: string,
  anchors: SlurpCanonAnchors | null,
): Promise<void> {
  await updateAnchors(db, accountId, (stored) => {
    const extracted = stored?.edited ? stored.extracted : stored?.anchors;
    // The editor sends an empty essentials list for a card not read for them yet. That is "not
    // read", not "the player removed them all", or the first reading could never add any.
    const unread = stored?.anchors?.essentials === undefined && extracted?.essentials === undefined;
    const mine =
      anchors && unread && !anchors.essentials?.length
        ? normalizeSlurpCanonAnchors({ ...anchors, essentials: undefined })
        : anchors;
    return { key: stored?.key ?? "", anchors: mine, edited: true, ...(extracted === undefined ? {} : { extracted }) };
  });
}

/** Forget the anchors, the player's edits included, so the next post reads the card again. */
export async function clearSlurpCanonAnchors(db: DB, accountId: string): Promise<void> {
  failedUntil.delete(accountId);
  await updateAnchors(db, accountId, () => null);
}
