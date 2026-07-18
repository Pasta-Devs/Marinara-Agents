import { readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { ltmRetentionConfigSchema } from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { DEFAULT_LTM_RETENTION_CONFIG } from "./default-config.js";
import { readJsonFile } from "./atomic-json.js";
import { isEnoent } from "./ltm-utils.js";
import { getLongTermMemoryDirectories, getLongTermMemoryRoot, safeJoin } from "./paths.js";
export const longTermMemoryRetentionConfigPath = (root = getLongTermMemoryRoot()) => safeJoin(getLongTermMemoryDirectories(root).config, "retention.json");
export async function runLongTermMemoryRetention({ root = getLongTermMemoryRoot(), now = new Date(), force = false } = {}) { const tx = await readdir(getLongTermMemoryDirectories(root).transactions).catch((e) => { if (isEnoent(e)) return []; throw e; }); if (tx.some((x) => x.endsWith(".json"))) return { ran: true, skippedPendingRecovery: true, quarantineArtifacts: 0 }; const config = ltmRetentionConfigSchema.parse(await readJsonFile(longTermMemoryRetentionConfigPath(root), DEFAULT_LTM_RETENTION_CONFIG)); const cutoff = new Date(now).getTime() - config.quarantineRetentionDays * 86400000; const quarantine = join(root, "quarantine"); let removed = 0; for (const entry of await readdir(quarantine, { withFileTypes: true }).catch((e) => { if (isEnoent(e)) return []; throw e; })) { const path = join(quarantine, entry.name); if ((await stat(path)).mtimeMs < cutoff) { await rm(path, { recursive: true, force: true }); removed++; } } return { ran: force || true, skippedPendingRecovery: false, quarantineArtifacts: removed }; }
