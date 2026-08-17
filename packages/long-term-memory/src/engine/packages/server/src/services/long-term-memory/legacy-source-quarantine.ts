import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename } from "node:fs/promises";
import { basename, dirname } from "node:path";
import { getLongTermMemoryDirectories, safeJoin } from "./paths.js";

function isCapturedTurnSource(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const note = value as Record<string, unknown>;
  return (
    (typeof note.id === "string" && note.id.startsWith("source_turn_")) ||
    (Array.isArray(note.tags) && note.tags.includes("captured_turn"))
  );
}

export async function quarantineLegacyCapturedTurnSources(root: string) {
  const sources = safeJoin(getLongTermMemoryDirectories(root).vault, "sources");
  const quarantine = safeJoin(root, `quarantine/legacy-captured-turns-${Date.now()}-${randomUUID()}`);
  let moved = 0;
  for (const entry of await readdir(sources, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const path = safeJoin(sources, entry.name);
    let value: unknown;
    try {
      value = JSON.parse(await readFile(path, "utf8"));
    } catch {
      continue;
    }
    if (!isCapturedTurnSource(value)) continue;
    const target = safeJoin(quarantine, basename(path));
    await mkdir(dirname(target), { recursive: true });
    await rename(path, target);
    moved += 1;
  }
  return moved;
}
