// ──────────────────────────────────────────────
// Otome Forge: Home cut-outs (plan M3 "Cut-outs", §1.8)
// ──────────────────────────────────────────────
// A look is painted full body on a flat grey background, so Home can lift him out of it: cutOut(url) reads the image
// over loopback, sends it to the Engine's POST /api/sprites/cleanup (not privilege-gated; the background remover when
// installed, else the built-in one), and keeps the result in the Global Gallery. The record lives on the unit,
// `unit.cutouts[url]`, with the paint record's states:
//   none      the next Home read queues it (his worn look and its ready faces, lazily)
//   pending   saved before the cleanup call, so it is made once; one with no live owner in this process (a restart)
//             is never made again
//   ready     `url` is the cut-out, `ref` its gallery reference (a deleted run takes it along)
//   failed    never tried again: Home pans slowly over the uncut look instead
// Cut-outs cost no model or image call. They run one at a time in this process, outside the background lane (which
// takes a model connection's admission slot).
// ponytail: a cut-out of a look that was repainted stays until the run is deleted; the upgrade path is pruning it with
// the expressions kit's stale sets.
import type { CapabilityRuntimeHost } from "@marinara-engine/shared";
import type { LiId, Paint, Unit } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { runDocTarget, unitId } from "../ids.js";
import { normalizeUnit } from "../schemas/unit.js";
import type { OtomeStore } from "../store.js";
import { galleryRef, loopbackBaseUrl, type PaintedImage } from "./image-client.js";

/** The Engine's own cleanup settings for a sprite sheet (sprites.routes.ts uses 35 for its cells). */
export const CUTOUT_STRENGTH = 35;
/** How long one loopback request may take. Cut-outs run one at a time, so a stalled cleanup would hold every later one. */
export const CUTOUT_TIMEOUT_MS = 120_000;
const ERROR_MAX = 300;

export interface CutoutClient {
  /** The Engine-served image at `url` cut out of its background and saved to the gallery. Throws; never retries. */
  cutOut(url: string): Promise<PaintedImage>;
  deleteGalleryImage(id: string): Promise<boolean>;
}

type Fetch = typeof fetch;

const SOURCE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

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

  return {
    async cutOut(url) {
      if (!url.startsWith("/")) throw new Error("only an image the Engine serves can be cut out");
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
          engine: "auto",
        }),
      })) as { cells?: Array<{ base64?: unknown }> } | null;
      const out = cleaned?.cells?.[0]?.base64;
      if (typeof out !== "string" || !out) throw new Error("the cleanup returned no image");
      const png = Buffer.from(out.replace(/^data:[^,]*,/, ""), "base64");
      const { width, height } = pngSize(png);
      // ponytail: repeats image-client's gallery upload (its uploadToGallery is internal); the upgrade path is the
      // image client exposing uploadToGallery, as the plan's §1.8 lists it.
      const form = new FormData();
      form.append("prompt", "Otome Hearth Home cut-out");
      form.append("provider", "sprite-cleanup");
      form.append("model", "auto");
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
      return { id, url: savedUrl };
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

// ── One at a time, each once ──

const live = new Set<string>();
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
    ? { state: "pending" }
    : { state: "uncut" };
}

/** Saves `record` for `url` unless `only` says it may not replace what is there; false when nothing was saved. */
async function save(
  deps: CutoutDeps,
  runId: string,
  li: LiId,
  url: string,
  record: Paint,
  only: (current: Paint | undefined) => boolean,
): Promise<boolean> {
  let saved = false;
  const unit = await deps.store.updateDoc(runDocTarget("unit", unitId(runId, li)), normalizeUnit, (current) => {
    saved = only(current.cutouts[url]);
    return saved ? { ...current, cutouts: { ...current.cutouts, [url]: record } } : current;
  });
  return !!unit && saved;
}

async function cutOne(deps: CutoutDeps, runId: string, li: LiId, url: string): Promise<void> {
  // Claimed in the document first: a record already there (another request's, or one left by a restart) wins.
  const claimed = await save(deps, runId, li, url, { state: "pending", at: new Date().toISOString() }, (now) => !now);
  if (!claimed) return;
  const client = clientOf(deps);
  let image: PaintedImage;
  try {
    image = await client.cutOut(url);
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error)).slice(0, ERROR_MAX);
    deps.runtime.logger.warn("[otome-forge] Home cut-out failed; the uncut look pans instead: %s", message);
    await save(deps, runId, li, url, { state: "failed", at: new Date().toISOString(), error: message }, isPending);
    return;
  }
  const ready: Paint = {
    state: "ready",
    at: new Date().toISOString(),
    url: image.url,
    ...(image.id ? { ref: galleryRef(image.id) } : {}),
  };
  let kept = false;
  try {
    kept = await save(deps, runId, li, url, ready, isPending);
  } finally {
    // A run deleted meanwhile (or a record replaced), or a save that failed, keeps nothing: the new gallery image goes.
    if (!kept && image.id) await client.deleteGalleryImage(image.id);
  }
}

const isPending = (current: Paint | undefined) => current?.state === "pending";

/**
 * Queues a cut-out of each url of his that has no record yet; each runs once, one at a time. Returns at once: Home
 * reads `pending` until the record is saved.
 */
export function queueCutouts(deps: CutoutDeps, runId: string, unit: Pick<Unit, "id" | "cutouts">, urls: string[]) {
  for (const url of new Set(urls)) {
    const key = liveKey(runId, unit.id, url);
    if (!url || unit.cutouts[url] || live.has(key)) continue;
    live.add(key);
    chain = chain
      .then(() => cutOne(deps, runId, unit.id, url))
      .catch((error: unknown) => deps.runtime.logger.error(error, "Otome Forge could not save a Home cut-out"))
      .finally(() => live.delete(key));
  }
}

/** Resolves once every cut-out queued so far has settled (tests). */
export const cutoutsSettled = () => chain;
