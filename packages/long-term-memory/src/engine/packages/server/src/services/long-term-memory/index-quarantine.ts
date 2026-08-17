import { randomUUID } from "node:crypto";
import { mkdir, rename } from "node:fs/promises";
import { dirname, relative } from "node:path";
import { isEnoent } from "./ltm-utils.js";
import { getLongTermMemoryDirectories, safeJoin } from "./paths.js";

export async function quarantineLtmIndexArtifact(root: string, path: string) {
  const dirs = getLongTermMemoryDirectories(root);
  const artifact = relative(dirs.indexes, path)
    .split(/[\\/]+/)
    .join("/");
  if (!artifact || artifact === ".." || artifact.startsWith("../"))
    throw new Error(`Index artifact is outside the long-term memory index directory: ${path}`);
  const target = safeJoin(root, `quarantine/indexes/${Date.now()}-${randomUUID()}/${artifact}`);
  try {
    await mkdir(dirname(target), { recursive: true });
    await rename(path, target);
    return target;
  } catch (error) {
    if (isEnoent(error)) return null;
    throw error;
  }
}
