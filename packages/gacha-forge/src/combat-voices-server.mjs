import { createHash as forgeCombatVoiceHash, randomUUID as forgeCombatVoiceUuid } from "node:crypto";
import { constants as forgeCombatVoiceFlags } from "node:fs";
import {
  mkdir as forgeCombatVoiceMkdir,
  lstat as forgeCombatVoiceLstat,
  open as forgeCombatVoiceOpen,
  opendir as forgeCombatVoiceOpendir,
  writeFile as forgeCombatVoiceWrite,
  rename as forgeCombatVoiceRename,
  unlink as forgeCombatVoiceUnlink,
  realpath as forgeCombatVoiceRealpath,
  rm as forgeCombatVoiceRm,
} from "node:fs/promises";
import { join as forgeCombatVoiceJoin } from "node:path";

export const forgeCombatVoiceSlots = ["death", "kill", "ultimateA", "ultimateB"];
const forgeCombatVoiceBytes = 512 * 1024;
const forgeCombatVoiceDigest = (value) => forgeCombatVoiceHash("sha256").update(value).digest("hex");

export function normalizeForgeCombatVoiceLines(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (Object.keys(value).some((key) => !forgeCombatVoiceSlots.includes(key))) return null;
  const lines = {};
  for (const slot of forgeCombatVoiceSlots) {
    const text = typeof value[slot] === "string" ? value[slot].trim() : "";
    if (!text || text.length > 180 || /\p{Cc}/u.test(text)) return null;
    lines[slot] = text;
  }
  return lines.ultimateA === lines.ultimateB ? null : lines;
}

export function forgeCombatVoiceMessages(unit, run = {}) {
  const source = unit?.forgeCardCanon || unit;
  const canon = ["description", "personality", "backstory", "appearance"]
    .filter((key) => typeof source?.[key] === "string" && source[key].trim())
    .map((key) => `${key}: ${source[key]}`)
    .join("\n");
  return [
    {
      role: "system",
      content:
        "Write exactly four reusable combat voice lines for this character. Return only JSON with the keys death, kill, ultimateA, ultimateB. Each value is a short spoken line of at most 180 characters, normally 3–12 words, in the world's language. Death is being defeated (not necessarily dying permanently); kill is defeating an opponent; ultimateA and ultimateB are two distinct ultimate lines. Preserve the authored character's personality and canon. Do not mention a specific enemy, current chapter, reward, game controls or a result that might not happen. No narration, stage directions or extra keys. These four lines will be saved and reused, not rewritten per battle.",
    },
    {
      role: "user",
      content: `Character: ${String(unit?.name || "")}\n${canon}\nWorld: ${String(run.scenario || "").slice(0, 4000)}${run.language ? `\nLanguage: ${String(run.language)}` : ""}`,
    },
  ];
}

function forgeCombatVoiceFormat(bytes) {
  if (bytes.length < 12 || bytes.length > forgeCombatVoiceBytes) return null;
  const ascii = (start, end) => bytes.toString("ascii", start, end);
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE") return { ext: "wav", mime: "audio/wav" };
  if (ascii(0, 4) === "OggS") return { ext: "ogg", mime: "audio/ogg" };
  if (ascii(0, 4) === "fLaC") return { ext: "flac", mime: "audio/flac" };
  if (ascii(4, 8) === "ftyp") return { ext: "m4a", mime: "audio/mp4" };
  if (bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return { ext: "webm", mime: "audio/webm" };
  if (ascii(0, 3) === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0))
    return (bytes[1] & 0xf6) === 0xf0 ? { ext: "aac", mime: "audio/aac" } : { ext: "mp3", mime: "audio/mpeg" };
  return null;
}

// Text and paid synthesis reservations survive application and browser restarts.
export function createForgeCombatVoices({ dataDir, runtime, readUnit, generateLines }) {
  const mutations = new Map();
  const lineJobs = new Map();
  const epochs = new Map();
  let disposed = false;
  const epoch = (runId) => epochs.get(runId) || 0;
  const mutate = async (runId, operation) => {
    const next = (mutations.get(runId) || Promise.resolve()).catch(() => {}).then(operation);
    mutations.set(runId, next);
    try {
      return await next;
    } finally {
      if (mutations.get(runId) === next) mutations.delete(runId);
    }
  };
  const directory = async (world, create = false) => {
    let path = await forgeCombatVoiceRealpath(dataDir);
    for (const segment of ["capability-package-data", "gacha-forge", "combat-voices", world]) {
      path = forgeCombatVoiceJoin(path, segment);
      if (create)
        await forgeCombatVoiceMkdir(path).catch((error) => {
          if (error.code !== "EEXIST") throw error;
        });
      const stat = await forgeCombatVoiceLstat(path);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Invalid combat voice directory");
    }
    return path;
  };
  const read = async (path) => {
    const file = await forgeCombatVoiceOpen(
      path,
      forgeCombatVoiceFlags.O_RDONLY | forgeCombatVoiceFlags.O_NOFOLLOW,
    ).catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (!file) return null;
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.size > 8192) throw new Error("Invalid combat voice record");
      try {
        const value = JSON.parse(await file.readFile("utf8"));
        return value && typeof value === "object" && !Array.isArray(value) ? value : { state: "failed", invalid: true };
      } catch {
        return { state: "failed", invalid: true };
      }
    } finally {
      await file.close();
    }
  };
  const write = async (folder, key, value) => {
    const temporary = forgeCombatVoiceJoin(folder, `.${key}.${forgeCombatVoiceUuid()}.tmp`);
    try {
      await forgeCombatVoiceWrite(temporary, JSON.stringify(value), { flag: "wx", mode: 0o600 });
      await forgeCombatVoiceRename(temporary, forgeCombatVoiceJoin(folder, `${key}.json`));
    } finally {
      await forgeCombatVoiceUnlink(temporary).catch(() => {});
    }
  };
  const context = async (body, extra = [], allowDisabled = false) => {
    if (
      disposed ||
      !dataDir ||
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).some(
        (key) =>
          !["runId", "unitId", "characterId", "voiceIdentity", "retry", "debugMode", "timeZone", ...extra].includes(
            key,
          ),
      )
    )
      return null;
    for (const key of ["runId", "unitId", "characterId", "voiceIdentity"])
      if (typeof body[key] !== "string" || !body[key].trim() || body[key].length > 700 || /\p{Cc}/u.test(body[key]))
        return null;
    const ownEpoch = epoch(body.runId);
    const found = await readUnit(body.runId, body.unitId);
    if (
      !found?.run ||
      !found.unit ||
      disposed ||
      ownEpoch !== epoch(body.runId) ||
      body.characterId !== (found.unit.characterId || found.unit.cardId) ||
      (!allowDisabled && (found.run.audio?.combatVoices !== true || found.run.combat?.mode !== "formation"))
    )
      return null;
    return {
      ...found,
      body,
      world: forgeCombatVoiceDigest(body.runId),
      unitKey: forgeCombatVoiceDigest(JSON.stringify([body.unitId, body.characterId, "lines"])),
      ownEpoch,
    };
  };
  const current = (ctx) => !disposed && ctx.ownEpoch === epoch(ctx.body.runId);
  const clipKey = (ctx, slot, text) =>
    forgeCombatVoiceDigest(JSON.stringify([ctx.body.unitId, ctx.body.characterId, ctx.body.voiceIdentity, slot, text]));
  const url = (ctx, record) => `/api/gacha-forge/combat-voices/file/${ctx.world}/${record.mediaKey}.${record.ext}`;
  const usable = async (folder, record) => {
    if (
      record?.state !== "ready" ||
      !/^[a-f0-9]{64}$/u.test(record.mediaKey || "") ||
      !["wav", "ogg", "flac", "m4a", "webm", "mp3", "aac"].includes(record.ext)
    )
      return false;
    const stat = await forgeCombatVoiceLstat(forgeCombatVoiceJoin(folder, `${record.mediaKey}.${record.ext}`)).catch(
      () => null,
    );
    return !!stat?.isFile() && !stat.isSymbolicLink() && stat.size >= 12 && stat.size <= forgeCombatVoiceBytes;
  };
  const retireUncommitted = async (folder, mediaKey, ext) => {
    try {
      let count = 0;
      for await (const entry of await forgeCombatVoiceOpendir(folder)) {
        if (++count > 2048) return;
        if (!/^[a-f0-9]{64}\.json$/u.test(entry.name)) continue;
        const record = await read(forgeCombatVoiceJoin(folder, entry.name));
        if (record?.invalid || (record?.mediaKey === mediaKey && record.ext === ext)) return;
      }
      await forgeCombatVoiceUnlink(forgeCombatVoiceJoin(folder, `${mediaKey}.${ext}`));
    } catch (error) {
      runtime?.logger?.warn(error, "[gacha-forge] Could not retire an uncommitted combat voice");
    }
  };
  const safe = async (operation) => {
    try {
      return await operation();
    } catch (error) {
      runtime?.logger?.warn(error, "[gacha-forge] Combat voice storage or generation failed");
      return { ok: false, error: "combat-voices-failed", retry: true };
    }
  };
  const linesFor = async (ctx) => {
    const key = `${ctx.body.runId}:${ctx.unitKey}`;
    if (lineJobs.has(key)) return lineJobs.get(key).promise;
    const job = { controller: new AbortController(), runId: ctx.body.runId };
    job.promise = (async () => {
      let folder;
      const prepared = await mutate(ctx.body.runId, async () => {
        if (!current(ctx)) return { ok: false, error: "not-found" };
        folder = await directory(ctx.world, true);
        const record = await read(forgeCombatVoiceJoin(folder, `${ctx.unitKey}.json`));
        const lines = record?.state === "ready" && normalizeForgeCombatVoiceLines(record.lines);
        if (lines) return { ok: true, lines };
        if (record && ctx.body.retry !== true) return { ok: false, error: "combat-voices-failed", retry: true };
        await write(folder, ctx.unitKey, { state: "pending" });
        return null;
      });
      if (prepared) return prepared;
      try {
        const result = await generateLines({
          runId: ctx.body.runId,
          run: ctx.run,
          unit: ctx.unit,
          messages: forgeCombatVoiceMessages(ctx.unit, ctx.run),
          debugMode: ctx.body.debugMode === true,
          signal: job.controller.signal,
        });
        const lines = result?.ok === false ? null : normalizeForgeCombatVoiceLines(result?.value || result);
        if (!lines) throw new Error("Invalid fixed combat voice lines");
        return await mutate(ctx.body.runId, async () => {
          if (!current(ctx)) return { ok: false, error: "not-found" };
          await write(folder, ctx.unitKey, { state: "ready", lines });
          return { ok: true, lines };
        });
      } catch (error) {
        if (current(ctx)) await mutate(ctx.body.runId, () => write(folder, ctx.unitKey, { state: "failed" }));
        throw error;
      }
    })().finally(() => {
      if (lineJobs.get(key) === job) lineJobs.delete(key);
    });
    lineJobs.set(key, job);
    return job.promise;
  };
  const readySlot = async (ctx, slot) => {
    const folder = await directory(ctx.world);
    const record = await read(forgeCombatVoiceJoin(folder, `${ctx.unitKey}.json`));
    const lines = record?.state === "ready" && normalizeForgeCombatVoiceLines(record.lines);
    if (!lines || !forgeCombatVoiceSlots.includes(slot)) return null;
    const key = clipKey(ctx, slot, lines[slot]);
    return { folder, key, text: lines[slot], record: await read(forgeCombatVoiceJoin(folder, `${key}.json`)) };
  };
  return {
    prepare(body) {
      return safe(async () => {
        const ctx = await context(body);
        if (!ctx) return { ok: false, error: "combat-voices-off" };
        const result = await linesFor(ctx);
        if (!result.ok || !current(ctx)) return result.ok ? { ok: false, error: "not-found" } : result;
        const folder = await directory(ctx.world);
        const clips = [];
        for (const slot of forgeCombatVoiceSlots) {
          const key = clipKey(ctx, slot, result.lines[slot]);
          const record = await read(forgeCombatVoiceJoin(folder, `${key}.json`));
          const ready = await usable(folder, record);
          clips.push({
            slot,
            text: result.lines[slot],
            state: ready ? "ready" : record ? "failed" : "missing",
            ...(ready ? { url: url(ctx, record) } : {}),
          });
        }
        return { ok: true, clips };
      });
    },
    reserve(body) {
      return safe(async () => {
        const ctx = await context(body, ["slot"]);
        if (!ctx) return { ok: false, error: "combat-voices-off" };
        return mutate(body.runId, async () => {
          if (!current(ctx)) return { ok: false, error: "not-found" };
          const saved = await readySlot(ctx, body.slot);
          if (!saved) return { ok: false, error: "bad-request" };
          if (await usable(saved.folder, saved.record)) return { ok: true, cached: true, url: url(ctx, saved.record) };
          if (saved.record && body.retry !== true) return { ok: false, error: "combat-voices-failed", retry: true };
          // ponytail: keep at most 2048 cache files per world; add explicit cache management if larger collections need it.
          let count = 0;
          for await (const _entry of await forgeCombatVoiceOpendir(saved.folder))
            if (++count >= 2048) return { ok: false, error: "combat-voices-storage-full" };
          const token = forgeCombatVoiceUuid();
          await write(saved.folder, saved.key, { state: "pending", token });
          return { ok: true, token, text: saved.text };
        });
      });
    },
    commit(body) {
      return safe(async () => {
        const ctx = await context(body, ["slot", "token", "base64"], true);
        if (
          !ctx ||
          typeof body.token !== "string" ||
          typeof body.base64 !== "string" ||
          body.base64.length > Math.ceil(forgeCombatVoiceBytes / 3) * 4 ||
          !/^[A-Za-z0-9+/]+={0,2}$/u.test(body.base64)
        )
          return { ok: false, error: "bad-request" };
        const bytes = Buffer.from(body.base64, "base64");
        const format = forgeCombatVoiceFormat(bytes);
        if (!format || bytes.toString("base64") !== body.base64) return { ok: false, error: "bad-audio" };
        return mutate(body.runId, async () => {
          if (!current(ctx)) return { ok: false, error: "not-found" };
          const saved = await readySlot(ctx, body.slot);
          if (!saved || saved.record?.state !== "pending" || saved.record.token !== body.token)
            return { ok: false, error: "stale-combat-voice" };
          const mediaKey = forgeCombatVoiceDigest(bytes);
          const temporary = forgeCombatVoiceJoin(saved.folder, `.${mediaKey}.${forgeCombatVoiceUuid()}.tmp`);
          try {
            await forgeCombatVoiceWrite(temporary, bytes, { flag: "wx", mode: 0o600 });
            await forgeCombatVoiceRename(temporary, forgeCombatVoiceJoin(saved.folder, `${mediaKey}.${format.ext}`));
          } finally {
            await forgeCombatVoiceUnlink(temporary).catch(() => {});
          }
          const record = { state: "ready", mediaKey, ...format };
          try {
            await write(saved.folder, saved.key, record);
          } catch (error) {
            await retireUncommitted(saved.folder, mediaKey, format.ext);
            throw error;
          }
          return { ok: true, url: url(ctx, record) };
        });
      });
    },
    fail(body) {
      return safe(async () => {
        const ctx = await context(body, ["slot", "token"], true);
        if (!ctx || typeof body.token !== "string") return { ok: false, error: "bad-request" };
        return mutate(body.runId, async () => {
          if (!current(ctx)) return { ok: false, error: "not-found" };
          const saved = await readySlot(ctx, body.slot);
          if (!saved || saved.record?.token !== body.token || saved.record.state !== "pending")
            return { ok: false, error: "stale-combat-voice" };
          await write(saved.folder, saved.key, { state: "failed" });
          return { ok: true };
        });
      });
    },
    async serve(request, reply) {
      const world = request.params?.world;
      const filename = request.params?.filename;
      if (
        disposed ||
        !dataDir ||
        !/^[a-f0-9]{64}$/u.test(world || "") ||
        !/^[a-f0-9]{64}\.(?:wav|ogg|flac|m4a|webm|mp3|aac)$/u.test(filename || "")
      )
        return reply.code(404).send();
      const folder = await directory(world).catch(() => null);
      if (!folder) return reply.code(404).send();
      const file = await forgeCombatVoiceOpen(
        forgeCombatVoiceJoin(folder, filename),
        forgeCombatVoiceFlags.O_RDONLY | forgeCombatVoiceFlags.O_NOFOLLOW,
      ).catch(() => null);
      if (!file) return reply.code(404).send();
      const stat = await file.stat().catch(() => null);
      if (!stat || !stat.isFile() || stat.size < 12 || stat.size > forgeCombatVoiceBytes) {
        await file.close();
        return reply.code(404).send();
      }
      const types = {
        wav: "audio/wav",
        ogg: "audio/ogg",
        flac: "audio/flac",
        m4a: "audio/mp4",
        webm: "audio/webm",
        mp3: "audio/mpeg",
        aac: "audio/aac",
      };
      reply
        .header("Content-Type", types[filename.split(".").at(-1)])
        .header("X-Content-Type-Options", "nosniff")
        .header("Cache-Control", "private, max-age=31536000, immutable")
        .header("Content-Length", stat.size);
      if (request.method === "HEAD") {
        await file.close();
        return reply.send();
      }
      return reply.send(file.createReadStream({ autoClose: true }));
    },
    async removeWorld(runId) {
      epochs.set(runId, epoch(runId) + 1);
      for (const job of lineJobs.values()) if (job.runId === runId) job.controller.abort();
      await mutate(runId, async () => {
        const folder = await directory(forgeCombatVoiceDigest(runId)).catch((error) => {
          if (error.code === "ENOENT") return null;
          throw error;
        });
        if (folder) await forgeCombatVoiceRm(folder, { recursive: true, force: true });
      });
    },
    dispose() {
      disposed = true;
      for (const job of lineJobs.values()) job.controller.abort();
    },
  };
}
