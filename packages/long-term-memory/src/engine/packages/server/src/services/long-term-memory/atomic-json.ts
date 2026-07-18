import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { link, mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import { isEnoent } from "./ltm-utils.js";

const RETRIES = [10, 25, 50] as const;
export async function fsyncPath(path: string) { let h; try { h = await open(path, constants.O_RDONLY); await h.sync(); } catch {} finally { await h?.close().catch(() => {}); } }
export async function renameWithRetry(from: string, to: string, fn = rename) {
  for (let attempt = 0;; attempt++) try { await fn(from, to); return; } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (!(code === "EPERM" || code === "EACCES" || code === "EBUSY") || attempt >= RETRIES.length) throw error;
    await new Promise((resolve) => setTimeout(resolve, RETRIES[attempt]));
  }
}
async function atomic(path: string, content: string) {
  await mkdir(dirname(path), { recursive: true }); const tmp = `${path}.tmp-${process.pid}-${Date.now()}-${randomUUID()}`; let h;
  try { h = await open(tmp, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600); await h.writeFile(content, "utf8"); await h.sync(); await h.close(); h = undefined; await renameWithRetry(tmp, path); await fsyncPath(dirname(path)); }
  catch (error) { await h?.close().catch(() => {}); await unlink(tmp).catch(() => {}); throw error; }
}
export function writeJsonAtomic(path: string, value: unknown) { return atomic(path, `${JSON.stringify(value, null, 2)}\n`); }
export function writeTextAtomic(path: string, value: string) { return atomic(path, value); }
export async function createJsonFileExclusive(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true }); const tmp = `${path}.tmp-${randomUUID()}`;
  await writeTextAtomic(tmp, `${JSON.stringify(value, null, 2)}\n`); try { await link(tmp, path); } finally { await unlink(tmp).catch(() => {}); }
}
export async function readJsonFile<T>(path: string, fallback: T): Promise<T> { try { return JSON.parse(await readFile(path, "utf8")) as T; } catch (error) { if (isEnoent(error)) return fallback; throw error; } }
export async function appendJsonLineAtomic(path: string, value: unknown) { await mkdir(dirname(path), { recursive: true }); const h = await open(path, constants.O_CREAT | constants.O_APPEND | constants.O_WRONLY, 0o600); try { await h.writeFile(`${JSON.stringify(value)}\n`); await h.sync(); } finally { await h.close(); } }
