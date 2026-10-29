// ──────────────────────────────────────────────
// Otome Forge: Home cut-outs (plan M3 "Cut-outs", §1.8)
// ──────────────────────────────────────────────
// A look is painted full body on a chroma backdrop, so Home can lift him out of it: cutOut(url) reads the image
// over loopback, sends it to the Engine's POST /api/sprites/cleanup (the repaired built-in matte when advertised,
// legacy auto otherwise), and keeps the result in the Global Gallery. The record lives on the unit or player,
// `unit.cutouts[url]`, with the paint record's states:
//   none      the next Home read queues it (his worn look and its ready faces, lazily)
//   pending   saved before cleanup; an existing derivative remains visible until the replacement succeeds
//   ready     `url` is the cut-out, `ref` its gallery reference (a deleted run takes it along)
//   failed    never tried again by the same cleanup revision: Home pans over the uncut look instead
// A newer Engine cleanup revision rebuilds an obsolete derivative from the retained original, without paid painting.
// Cut-outs cost no model or image call. They run one at a time in this process, outside the background lane (which
// takes a model connection's admission slot).
// ponytail: a cut-out of a look that was repainted stays until the run is deleted; the upgrade path is pruning it with
// the expressions kit's stale sets.
import type { CapabilityRuntimeHost } from "@marinara-engine/shared";
import type { Cutout, LiId, Unit } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { playerId, runDocTarget, unitId } from "../ids.js";
import { normalizePlayer } from "../schemas/player.js";
import { normalizeUnit } from "../schemas/unit.js";
import type { OtomeStore } from "../store.js";
import { galleryRef, loopbackBaseUrl, type PaintedImage } from "./image-client.js";

/** The Engine's own cleanup settings for a sprite sheet (sprites.routes.ts uses 35 for its cells). */
export const CUTOUT_STRENGTH = 35;
/** How long one loopback request may take. Cut-outs run one at a time, so a stalled cleanup would hold every later one. */
export const CUTOUT_TIMEOUT_MS = 120_000;
const ERROR_MAX = 300;

export interface CutoutClient {
  /** Optional on older hosts and test clients: only an advertised newer revision invalidates a cached derivative. */
  cleanupRevision?(): Promise<number | undefined>;
  /** The Engine-served image at `url` cut out of its background and saved to the gallery. Throws; never retries. */
  cutOut(url: string): Promise<PaintedImage & { cleanupRevision?: number }>;
  deleteGalleryImage(id: string): Promise<boolean>;
}

type Fetch = typeof fetch;

const SOURCE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
const readRevision = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : undefined;

/** Width and height from a PNG's IHDR chunk, or nothing for bytes that are not a PNG. */
function pngSize(bytes: Buffer): { width?: number; height?: number } {
  const signature = bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a";
  return signature && bytes.length >= 24 ? { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) } : {};
}

/** The loopback client: read, clean up, upload. */
export function createCutoutClient({
  baseUrl = loopbackBaseUrl(),
  fetch: fetchImpl = globalThis.fetch,
  timeoutMs = CUTOUT_TIMEOUT_MS,
}: { baseUrl?: string; fetch?: Fetch; timeoutMs?: number } = {}): CutoutClient {
  // A timeout throws inside cutOut, which records the cut-out as failed (Home pans over the uncut look instead).
  const timeout = () => AbortSignal.timeout(timeoutMs);
  async function json(path: string, init: RequestInit): Promise<unknown> {
    const response = await fetchImpl(`${baseUrl}${path}`, { ...init, signal: timeout() });
    if (!response.ok) throw new Error(`engine ${path} -> ${response.status}`);
    return response.json();
  }

  let revision: Promise<number | undefined> | undefined;
  return {
    cleanupRevision() {
      // The Engine restarts when its implementation changes. One small status read per process keeps older hosts
      // compatible and avoids rebuilding old cut-outs with the same implementation that damaged them.
      if (!revision) {
        const pending = (async () => {
          const response = await fetchImpl(`${baseUrl}/api/sprites/cleanup/status`, {
            signal: AbortSignal.timeout(Math.min(timeoutMs, 2000)),
          });
          if (response.status === 404) return undefined;
          if (!response.ok) throw new Error(`cleanup status -> ${response.status}`);
          const status = (await response.json()) as { cleanupRevision?: unknown } | null;
          return readRevision(status?.cleanupRevision);
        })();
        revision = pending;
        void pending.catch(() => {
          if (revision === pending) revision = undefined;
        });
      }
      return revision.catch(() => undefined);
    },
    async cutOut(url) {
      if (!url.startsWith("/")) throw new Error("only an image the Engine serves can be cut out");
      const availableRevision = await this.cleanupRevision?.();
      // Our generated looks have a controlled flat matte. Use its preservation repair instead of AI segmentation,
      // but only after the host advertises it; older hosts retain their existing cleanup behavior.
      const engine = availableRevision !== undefined && availableRevision >= 2 ? "builtin" : "auto";
      const source = await fetchImpl(`${baseUrl}${url}`, { signal: timeout() });
      const mime = (source.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
      if (!source.ok || !SOURCE_TYPES.has(mime)) throw new Error(`could not read ${url.slice(0, 80)}`);
      const base64 = Buffer.from(await source.arrayBuffer()).toString("base64");
      const cleaned = (await json("/api/sprites/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cells: [{ expression: "cut", base64: `data:${mime};base64,${base64}` }],
          cleanupStrength: CUTOUT_STRENGTH,
          engine,
        }),
      })) as { cells?: Array<{ base64?: unknown }>; cleanupRevision?: unknown } | null;
      const out = cleaned?.cells?.[0]?.base64;
      if (typeof out !== "string" || !out) throw new Error("the cleanup returned no image");
      const png = Buffer.from(out.replace(/^data:[^,]*,/, ""), "base64");
      const { width, height } = pngSize(png);
      // ponytail: repeats image-client's gallery upload (its uploadToGallery is internal); the upgrade path is the
      // image client exposing uploadToGallery, as the plan's §1.8 lists it.
      const form = new FormData();
      form.append("prompt", "Otome Hearth cut-out");
      form.append("provider", "sprite-cleanup");
      form.append("model", engine);
      if (width && height) {
        form.append("width", String(width));
        form.append("height", String(height));
      }
      form.append("file", new Blob([png], { type: "image/png" }), "cutout.png");
      const saved = (await json("/api/global-gallery/upload", { method: "POST", body: form })) as {
        id?: unknown;
        url?: unknown;
      } | null;
      const id = typeof saved?.id === "string" ? saved.id : "";
      const savedUrl = typeof saved?.url === "string" ? saved.url : "";
      if (!id || !savedUrl) throw new Error("gallery upload returned no image");
      // The response advertises the host's revision even when auto used AI segmentation.
      const cleanupRevision = engine === "builtin" ? readRevision(cleaned?.cleanupRevision) : undefined;
      return { id, url: savedUrl, ...(cleanupRevision ? { cleanupRevision } : {}) };
    },

    async deleteGalleryImage(id) {
      try {
        return (await fetchImpl(`${baseUrl}/api/global-gallery/${encodeURIComponent(id)}`, { method: "DELETE" })).ok;
      } catch {
        return false;
      }
    },
  };
}

let defaultClient: CutoutClient | null = null;
const clientOf = (deps: CutoutDeps) => deps.cutouts ?? (defaultClient ??= createCutoutClient());

export interface CutoutDeps {
  runtime: Pick<CapabilityRuntimeHost, "logger">;
  store: Pick<OtomeStore, "updateDoc">;
  /** The loopback client by default; tests pass a fake. */
  cutouts?: CutoutClient;
}

/** Love interests and the protagonist share cleanup; each keeps derivatives in its own existing document. */
type CutoutOwner = LiId | "player";

// ── One at a time, each once ──

const live = new Set<string>();
// A transient refresh failure keeps the previous cut-out. Retry after an Engine restart instead of every Home poll.
const refreshAttempts = new Set<string>();
let chain: Promise<void> = Promise.resolve();
const liveKey = (runId: string, li: LiId, url: string) => `${runId}|${li}|${url}`;

export type CutoutState = "ready" | "pending" | "uncut";

/** How Home shows `url` of this unit: its cut-out, one on the way, or the uncut look (with a slow pan). */
export function cutoutView(
  runId: string,
  unit: Pick<Unit, "id" | "cutouts">,
  url: string,
): { state: CutoutState; cutout?: string } {
  const record = unit.cutouts[url];
  if (record?.state === "ready" && record.url) return { state: "ready", cutout: record.url };
  if (!record) return { state: "pending" };
  return record.state === "pending" && live.has(liveKey(runId, unit.id, url))
    ? { state: "pending", ...(record.url ? { cutout: record.url } : {}) }
    : record.url
      ? { state: "ready", cutout: record.url }
      : { state: "uncut" };
}

/** Free work still owned by this process, including a replacement whose old pixels remain visible meanwhile. */
export const cutoutsPending = (runId: string, units: Array<Pick<Unit, "id" | "cutouts">>) =>
  units.some((unit) => Object.keys(unit.cutouts).some((url) => cutoutView(runId, unit, url).state === "pending"));

/** Saves `record` for `url` unless `only` says it may not replace what is there; false when nothing was saved. */
async function save(
  deps: CutoutDeps,
  runId: string,
  li: CutoutOwner,
  url: string,
  record: Cutout,
  only: (current: Cutout | undefined) => boolean,
): Promise<boolean> {
  let saved = false;
  const update = <P extends { cutouts?: Record<string, Cutout> }>(current: P): P => {
    saved = only(current.cutouts?.[url]);
    return saved ? { ...current, cutouts: { ...current.cutouts, [url]: record } } : current;
  };
  const unit =
    li === "player"
      ? await deps.store.updateDoc(runDocTarget("player", playerId(runId)), normalizePlayer, update)
      : await deps.store.updateDoc(runDocTarget("unit", unitId(runId, li)), normalizeUnit, update);
  return !!unit && saved;
}

const needsCutout = (current: Cutout | undefined, revision: number | undefined) =>
  !current || (revision !== undefined && (current.cleanupRevision ?? 0) < revision);

async function cutOne(deps: CutoutDeps, runId: string, li: CutoutOwner, url: string, revision?: number): Promise<void> {
  // Claimed in the document first: a record already there (another request's, or one left by a restart) wins.
  const at = new Date().toISOString();
  let previous: Cutout | undefined;
  const pending: Cutout = { state: "pending", at };
  const claimed = await save(deps, runId, li, url, pending, (now) => {
    if (!needsCutout(now, revision)) return false;
    previous = now;
    // Keep the replaced derivative referenced until a successful replacement; a failed attempt keeps it for run deletion.
    if (now?.url) pending.url = now.url;
    if (now?.ref) pending.ref = now.ref;
    if (now?.previousRefs) pending.previousRefs = now.previousRefs;
    if (now?.cleanupRevision) pending.cleanupRevision = now.cleanupRevision;
    return true;
  });
  if (!claimed) return;
  const isOurs = (current: Cutout | undefined) => current?.state === "pending" && current.at === at;
  const client = clientOf(deps);
  let image: PaintedImage & { cleanupRevision?: number };
  try {
    image = await client.cutOut(url);
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error)).slice(0, ERROR_MAX);
    deps.runtime.logger.warn("[otome-forge] a cut-out failed; keeping the previous image when available: %s", message);
    await save(
      deps,
      runId,
      li,
      url,
      previous?.url ? { ...previous, state: "ready", error: message } : { ...pending, state: "failed", error: message },
      isOurs,
    );
    return;
  }
  const cleanupRevision = image.cleanupRevision;
  const ready: Cutout = {
    state: "ready",
    at: new Date().toISOString(),
    url: image.url,
    ...(image.id ? { ref: galleryRef(image.id) } : {}),
    ...(cleanupRevision ? { cleanupRevision } : {}),
  };
  const previousRefs = [
    ...new Set([...(previous?.previousRefs ?? []), ...(previous?.ref ? [previous.ref] : [])]),
  ].filter((ref) => ref !== ready.ref);
  if (previousRefs.length) ready.previousRefs = previousRefs;
  let kept = false;
  try {
    kept = await save(deps, runId, li, url, ready, isOurs);
  } finally {
    // A run deleted meanwhile (or a record replaced), or a save that failed, keeps nothing: the new gallery image goes.
    if (!kept && image.id) await client.deleteGalleryImage(image.id);
  }
}

/**
 * Reads the host's cached cleanup revision, then queues missing or obsolete derivatives, one at a time. Returns a
 * view of the unit with queued cut-outs pending so Home and the reader poll until their replacement is saved.
 */
export async function queueCutouts<T extends Pick<Unit, "id" | "cutouts">>(
  deps: CutoutDeps,
  runId: string,
  unit: T,
  urls: string[],
): Promise<T> {
  if (!urls.some(Boolean)) return unit;
  const revision = await clientOf(deps).cleanupRevision?.();
  const cutouts = { ...unit.cutouts };
  for (const url of new Set(urls)) {
    const key = liveKey(runId, unit.id, url);
    if (!url || !needsCutout(unit.cutouts[url], revision)) continue;
    const refreshKey = `${key}|${revision}`;
    if (unit.cutouts[url] && refreshAttempts.has(refreshKey) && !live.has(key)) continue;
    // The response must show pending while an obsolete cached image is replaced, so Home and the reader keep polling.
    cutouts[url] = { ...unit.cutouts[url], state: "pending", at: unit.cutouts[url]?.at ?? "" };
    if (live.has(key)) continue;
    refreshAttempts.add(refreshKey);
    live.add(key);
    chain = chain
      .then(() => cutOne(deps, runId, unit.id, url, revision))
      .catch((error: unknown) => deps.runtime.logger.error(error, "Otome Forge could not save a cut-out"))
      .finally(() => live.delete(key));
  }
  return { ...unit, cutouts };
}

/** Resolves once every cut-out queued so far has settled (tests). */
export const cutoutsSettled = () => chain;
