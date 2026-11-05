import { createHash as forgeAnimationHash, randomUUID as forgeAnimationUuid } from "node:crypto";
import { constants as forgeAnimationFlags } from "node:fs";
import {
  mkdir as forgeAnimationMkdir,
  lstat as forgeAnimationLstat,
  open as forgeAnimationOpen,
  opendir as forgeAnimationOpendir,
  readFile as forgeAnimationRead,
  writeFile as forgeAnimationWrite,
  rename as forgeAnimationRename,
  unlink as forgeAnimationUnlink,
  rm as forgeAnimationRm,
  realpath as forgeAnimationRealpath,
} from "node:fs/promises";
import { join as forgeAnimationJoin } from "node:path";

const forgeAnimationDigest = (value) => forgeAnimationHash("sha256").update(value).digest("hex");
const forgeAnimationBanners = new Set(["char-standard", "wpn-standard", "char-featured", "wpn-featured"]);
const forgeAnimationPrompt =
  "Animate this gacha banner illustration as a seamless short loop. Preserve the exact composition, faces, outfits and artwork style. Fixed camera, subtle breathing, gently moving hair and fabric, small ambient particles or light. Return smoothly to the starting pose and lighting in the last frame. No cuts, zooms, new subjects, text or logos.";
const forgeAnimationReasons = new Set([
  "seedance-reference-setup",
  "source-image",
  "connection",
  "provider",
  "invalid-response",
  "storage",
  "timeout",
  "unknown",
]);
const forgeAnimationSavedFailure = (value) => {
  if (!forgeAnimationReasons.has(value?.reason)) return { reason: "unknown" };
  return {
    reason: value.reason,
    ...(value.reason === "provider" &&
    Number.isInteger(value.providerStatus) &&
    value.providerStatus >= 400 &&
    value.providerStatus <= 599
      ? { providerStatus: value.providerStatus }
      : {}),
  };
};
const forgeAnimationFailure = (error) => {
  // The package never receives API keys, so only classified failures and HTTP numbers may leave the server.
  const message = typeof error?.message === "string" ? error.message : "";
  const code = String(error?.code || error?.cause?.code || "");
  if (
    /Seedance image-to-video references require a publicly reachable HTTPS image URL|Seedance (?:first|last) frame reference (?:URL must be public HTTPS|has no public HTTPS URL)|Temporary Seedance reference upload/u.test(
      message,
    )
  )
    return { reason: "seedance-reference-setup" };
  if (
    /Global Gallery image not found|The selected gallery image (?:cannot be read|is too large)|This picture (?:needs converting|can't be read)/u.test(
      message,
    )
  )
    return { reason: "source-image" };
  if (
    /Video generation connection not found|not a video generation connection|requires an? .+ API key|ToAPIs adapter|Unsupported video generation service/u.test(
      message,
    )
  )
    return { reason: "connection" };
  // Engine prefixes provider HTTP failures as "returned 4xx", "failed (4xx)" or "download … video (4xx)".
  const status = /(?:\breturned|\bfailed|\bvideo)\s*\(?([45]\d{2})\b/iu.exec(message);
  if (status) return { reason: "provider", providerStatus: Number(status[1]) };
  if (/generation (?:failed|cancelled|canceled|expired|error)\b|workflow failed|completed without/iu.test(message))
    return { reason: "provider" };
  if (
    error?.code === "ERR_INVALID_URL" ||
    /Invalid banner animation video|OpenRouter video .*(?:polling|content) URL|non-JSON|non-MP4|response did not include/u.test(
      message,
    )
  )
    return { reason: "invalid-response" };
  if (
    /timed out|queue is saturated/iu.test(message) ||
    /TIMEOUT|TIMEDOUT/u.test(code) ||
    error?.name === "TimeoutError"
  )
    return { reason: "timeout" };
  if (
    /^fetch failed$|did not resolve to any address/u.test(message) ||
    /^(?:ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH)$/u.test(code)
  )
    return { reason: "connection" };
  // The Engine server log keeps the raw message under "[gacha-forge] Banner animation failed".
  return { reason: "unknown" };
};

export function createForgeBannerAnimations({ dataDir, runtime, readBanner }) {
  const jobs = new Map();
  // Keys whose last status could not be written: their leftover "pending" marker is a storage failure, not a restart.
  const storageFailed = new Set();
  const epochs = new Map(),
    mutations = new Map();
  const epochFor = (runId) => epochs.get(runId) || 0;
  const mutate = async (runId, operation) => {
    const queued = (mutations.get(runId) || Promise.resolve()).catch(() => {}).then(operation);
    mutations.set(runId, queued);
    try {
      return await queued;
    } finally {
      if (mutations.get(runId) === queued) mutations.delete(runId);
    }
  };
  const urlFor = (runId, key) => `/api/gacha-forge/banner-animation/file/${forgeAnimationDigest(runId)}/${key}.mp4`;
  const exists = async (path) => {
    const stat = await forgeAnimationLstat(path).catch(() => null);
    return !!stat?.isFile() && !stat.isSymbolicLink() && stat.size > 0;
  };
  const storedMediaKey = async (folder, legacyKey, saved) => {
    const named = String(saved?.mediaKey || "");
    if (/^[a-f0-9]{64}$/u.test(named) && (await exists(forgeAnimationJoin(folder, `${named}.mp4`)))) return named;
    return (await exists(forgeAnimationJoin(folder, `${legacyKey}.mp4`))) ? legacyKey : null;
  };
  const directory = async (world, create = false) => {
    // DATA_DIR may deliberately be a symlink. Package-owned descendants may never be one.
    let path = await forgeAnimationRealpath(dataDir);
    for (const segment of ["capability-package-data", "gacha-forge", "banner-animations", world]) {
      path = forgeAnimationJoin(path, segment);
      if (create)
        await forgeAnimationMkdir(path).catch((error) => {
          if (error.code !== "EEXIST") throw error;
        });
      const stat = await forgeAnimationLstat(path);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Invalid animation directory");
    }
    return path;
  };
  const retireUnreferenced = async (folder, candidateKey, retainedKey) => {
    if (!candidateKey || candidateKey === retainedKey) return;
    try {
      let inspected = 0;
      for await (const entry of await forgeAnimationOpendir(folder)) {
        // ponytail: retain media above 512 entries; explicit cache compaction can handle larger worlds.
        if (++inspected > 512) return;
        if (!/^[a-f0-9]{64}\.json$/u.test(entry.name)) continue;
        const marker = await forgeAnimationOpen(
          forgeAnimationJoin(folder, entry.name),
          forgeAnimationFlags.O_RDONLY | forgeAnimationFlags.O_NOFOLLOW,
        );
        let saved;
        try {
          const stat = await marker.stat();
          if (!stat.isFile() || stat.size > 4096) return;
          const buffer = Buffer.alloc(4097);
          const { bytesRead } = await marker.read(buffer, 0, buffer.length, 0);
          if (bytesRead !== stat.size) return;
          try {
            saved = JSON.parse(buffer.subarray(0, bytesRead).toString("utf8"));
          } catch {
            // Pre-upgrade and malformed markers use their own input-key filename.
          }
        } finally {
          await marker.close();
        }
        // Use the same effective filename as generate, including missing named-file fallback.
        if ((await storedMediaKey(folder, entry.name.slice(0, -5), saved)) === candidateKey) return;
      }
      await forgeAnimationUnlink(forgeAnimationJoin(folder, `${candidateKey}.mp4`));
    } catch (error) {
      runtime.logger?.warn(error, "[gacha-forge] Could not retire a banner animation");
    }
  };
  const remove = async (runId) => {
    if (!dataDir) return;
    const folder = await directory(forgeAnimationDigest(runId)).catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (folder) await forgeAnimationRm(folder, { recursive: true, force: true });
  };

  return {
    async generate(body = {}) {
      if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body) ||
        Object.keys(body).some((key) => !["runId", "banner", "retry", "debugMode", "timeZone"].includes(key))
      )
        return { ok: false, error: "bad-request" };
      const runId = typeof body.runId === "string" ? body.runId.trim() : "";
      if (
        !runId ||
        runId.length > 200 ||
        (!forgeAnimationBanners.has(body.banner) && !/^story-event-[1-9]\d{0,8}$/u.test(body.banner || ""))
      )
        return { ok: false, error: "bad-request" };
      const epoch = epochFor(runId),
        superseded = () => epoch !== epochFor(runId);
      const banner = await readBanner(runId, body.banner);
      if (superseded()) return { ok: false, error: "not-found" };
      if (!banner?.connectionId) return { ok: false, error: "animations-off" };
      if (!banner.galleryImageId || !banner.art) return { ok: false, error: "banner-image-missing" };
      const animate = runtime?.integrations?.videos?.animateGalleryImage;
      if (typeof animate !== "function" || !dataDir) return { ok: false, error: "animation-unavailable" };
      const key = forgeAnimationDigest(
        JSON.stringify([
          runId,
          body.banner,
          banner.identity,
          banner.connectionId,
          banner.galleryImageId,
          forgeAnimationPrompt,
        ]),
      );
      let folder, file, status, previousKey;
      const result = (cached, mediaKey = key) => ({
        ok: true,
        animation: { key, url: urlFor(runId, mediaKey), poster: banner.art },
        cached,
      });
      const writeStatus = async (value) => {
        const temporary = forgeAnimationJoin(folder, `.${key}.${forgeAnimationUuid()}.status.tmp`);
        try {
          await forgeAnimationWrite(temporary, JSON.stringify(value), { flag: "wx", mode: 0o600 });
          await forgeAnimationRename(temporary, status);
        } finally {
          await forgeAnimationUnlink(temporary).catch(() => {});
        }
      };
      if (jobs.has(key)) return jobs.get(key).promise;
      const job = { controller: new AbortController(), runId };
      job.promise = (async () => {
        const prepared = await mutate(runId, async () => {
          if (superseded() || job.controller.signal.aborted) return { ok: false, error: "not-found" };
          folder = await directory(forgeAnimationDigest(runId), true);
          file = forgeAnimationJoin(folder, `${key}.mp4`);
          status = forgeAnimationJoin(folder, `${key}.json`);
          const prior = await forgeAnimationRead(status, {
            encoding: "utf8",
            flag: forgeAnimationFlags.O_RDONLY | forgeAnimationFlags.O_NOFOLLOW,
          }).catch(() => null);
          let saved;
          try {
            saved = JSON.parse(prior);
          } catch {
            // Older pending markers remain explicit-retry only.
          }
          previousKey = await storedMediaKey(folder, key, saved);
          if (previousKey && body.retry !== true) return result(true, previousKey);
          if (banner.generateAllowed === false) return { ok: false, error: "animations-off" };
          if (prior !== null && body.retry !== true) {
            // This process has no job for the key (checked above), so a pending attempt was cut short by an
            // Engine restart or package update; dispose() aborts it without writing a failed marker.
            const failure =
              saved?.state === "failed"
                ? forgeAnimationSavedFailure(saved)
                : saved?.state === "pending"
                  ? { reason: storageFailed.has(key) ? "storage" : "interrupted" }
                  : {};
            return { ok: false, error: "animation-failed", ...failure, retry: true };
          }
          // A persisted attempt also survives a restart during a paid request. Only an explicit retry starts another.
          storageFailed.delete(key);
          const pending = { state: "pending", ...(previousKey ? { mediaKey: previousKey } : {}) };
          if (body.retry === true || prior !== null) await writeStatus(pending);
          else await forgeAnimationWrite(status, JSON.stringify(pending), { flag: "wx", mode: 0o600 });
          return null;
        });
        if (superseded() || job.controller.signal.aborted) return { ok: false, error: "not-found" };
        if (prepared) return prepared;
        let storingClip = false;
        try {
          const video = await animate({
            connectionId: banner.connectionId,
            galleryImageId: banner.galleryImageId,
            prompt: forgeAnimationPrompt,
            durationSeconds: 5,
            aspectRatio: "16:9",
            loop: true,
            debugMode: body.debugMode === true,
            signal: job.controller.signal,
          });
          if (superseded() || job.controller.signal.aborted) return { ok: false, error: "not-found" };
          const bytes = typeof video?.base64 === "string" ? Buffer.from(video.base64, "base64") : null;
          if (
            video?.mimeType !== "video/mp4" ||
            !bytes ||
            bytes.length < 12 ||
            bytes.length > 128 * 1024 * 1024 ||
            bytes.toString("ascii", 4, 8) !== "ftyp"
          )
            throw new Error("Invalid banner animation video");
          storingClip = true;
          return await mutate(runId, async () => {
            if (superseded() || job.controller.signal.aborted) return { ok: false, error: "not-found" };
            // Each successful replacement has its own immutable URL. Keep the previous file and pointer
            // until both the new clip and its ready marker have been committed successfully.
            const mediaKey = forgeAnimationDigest(bytes);
            file = forgeAnimationJoin(folder, `${mediaKey}.mp4`);
            const temporary = forgeAnimationJoin(folder, `.${key}.${forgeAnimationUuid()}.tmp`);
            try {
              await forgeAnimationWrite(temporary, bytes, { flag: "wx", mode: 0o600 });
              await forgeAnimationRename(temporary, file);
            } finally {
              await forgeAnimationUnlink(temporary).catch(() => {});
            }
            try {
              await writeStatus({ state: "ready", mediaKey });
            } catch (error) {
              await retireUnreferenced(folder, mediaKey, previousKey);
              throw error;
            }
            await retireUnreferenced(folder, previousKey, mediaKey);
            return result(false, mediaKey);
          });
        } catch (error) {
          if (superseded() || job.controller.signal.aborted) return { ok: false, error: "not-found" };
          runtime.logger?.warn(error, "[gacha-forge] Banner animation failed");
          const failure = storingClip ? { reason: "storage" } : forgeAnimationFailure(error);
          await mutate(runId, async () => {
            if (superseded() || job.controller.signal.aborted) return;
            if ((await directory(forgeAnimationDigest(runId))) !== folder)
              throw new Error("Invalid animation directory");
            await writeStatus({ state: "failed", ...failure, ...(previousKey ? { mediaKey: previousKey } : {}) });
          });
          if (superseded() || job.controller.signal.aborted) return { ok: false, error: "not-found" };
          return {
            ok: false,
            error: "animation-failed",
            ...failure,
            retry: true,
          };
        }
      })()
        .catch((error) => {
          storageFailed.add(key);
          runtime.logger?.warn(error, "[gacha-forge] Banner animation storage failed");
          return { ok: false, error: "animation-failed", reason: "storage", retry: true };
        })
        .finally(() => {
          if (jobs.get(key) === job) jobs.delete(key);
        });
      jobs.set(key, job);
      return job.promise;
    },

    async serve(request, reply) {
      if (!dataDir) return reply.code(404).send();
      const world = request.params?.world,
        filename = request.params?.filename;
      if (!/^[a-f0-9]{64}$/u.test(world || "") || !/^[a-f0-9]{64}\.mp4$/u.test(filename || ""))
        return reply.code(404).send();
      const folder = await directory(world).catch(() => null);
      if (!folder) return reply.code(404).send();
      const file = await forgeAnimationOpen(
        forgeAnimationJoin(folder, filename),
        forgeAnimationFlags.O_RDONLY | forgeAnimationFlags.O_NOFOLLOW,
      ).catch(() => null);
      if (!file) return reply.code(404).send();
      const stat = await file.stat();
      if (!stat.isFile() || stat.size < 12) {
        await file.close();
        return reply.code(404).send();
      }
      reply
        .header("Content-Type", "video/mp4")
        .header("X-Content-Type-Options", "nosniff")
        .header("Accept-Ranges", "bytes")
        .header("Cache-Control", "private, max-age=31536000, immutable");
      let start = 0,
        end = stat.size - 1;
      const range = request.headers?.range;
      if (range) {
        const parts = /^bytes=(\d*)-(\d*)$/u.exec(range);
        if (!parts || (!parts[1] && !parts[2])) {
          await file.close();
          return reply.code(416).header("Content-Range", `bytes */${stat.size}`).send();
        }
        if (parts[1]) {
          start = Number(parts[1]);
          end = parts[2] ? Math.min(Number(parts[2]), end) : end;
        } else start = Math.max(0, stat.size - Number(parts[2]));
        if (
          !Number.isSafeInteger(start) ||
          !Number.isSafeInteger(end) ||
          start > end ||
          start >= stat.size ||
          (!parts[1] && Number(parts[2]) === 0)
        ) {
          await file.close();
          return reply.code(416).header("Content-Range", `bytes */${stat.size}`).send();
        }
        reply.code(206).header("Content-Range", `bytes ${start}-${end}/${stat.size}`);
      }
      reply.header("Content-Length", end - start + 1);
      if (request.method === "HEAD") {
        await file.close();
        return reply.send();
      }
      return reply.send(file.createReadStream({ start, end, autoClose: true }));
    },

    async removeWorld(runId) {
      epochs.set(runId, epochFor(runId) + 1);
      for (const [key, job] of jobs)
        if (job.runId === runId) {
          job.controller.abort();
          jobs.delete(key);
        }
      await mutate(runId, () => remove(runId));
    },

    dispose() {
      for (const job of jobs.values()) job.controller.abort();
    },
  };
}
