import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..");
const sharedEntry = process.env.MARINARA_SHARED_ENTRY ||
  resolve(repoRoot, "../Marinara-Engine/packages/shared/dist/index.js");
const shared = await import(pathToFileURL(sharedEntry).href);
const artifactsDir = join(repoRoot, "artifacts");
const packagesDir = join(repoRoot, "packages");
await mkdir(artifactsDir, { recursive: true });
await mkdir(packagesDir, { recursive: true });

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const catalogPackages = [];

for (const agent of shared.BUILT_IN_AGENT_MANIFESTS) {
  if (agent.libraryHidden || agent.runtimeDisabled) continue;
  const id = agent.id;
  const version = "1.0.0";
  const agentDefinition = {
    ...agent,
    author: agent.author || "Pasta Devs",
    defaultPromptTemplate: shared.getDefaultAgentPrompt(id),
  };
  const agentsBuffer = Buffer.from(`${JSON.stringify([agentDefinition], null, 2)}\n`);
  const manifest = {
    schemaVersion: 1,
    id,
    name: agent.name,
    version,
    description: agent.description,
    engine: { min: "2.2.2", maxExclusive: "3.0.0" },
    kind: ["agent"],
    entrypoints: { agents: "agents.json" },
    files: [{ path: "agents.json", sha256: sha256(agentsBuffer), bytes: agentsBuffer.byteLength }],
    permissions: ["agent-runtime", "chat-read", "prompt-context", "storage", "ui"],
    restartRequired: false,
  };
  const sourceDir = join(packagesDir, id);
  await mkdir(sourceDir, { recursive: true });
  await writeFile(join(sourceDir, "agents.json"), agentsBuffer);
  await writeFile(join(sourceDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  const temporary = await mkdtemp(join(tmpdir(), `marinara-agent-${id}-`));
  try {
    await writeFile(join(temporary, "agents.json"), agentsBuffer);
    await writeFile(join(temporary, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    const artifactName = `${id}-${version}.zip`;
    const artifactPath = join(artifactsDir, artifactName);
    await rm(artifactPath, { force: true });
    const zipped = spawnSync("zip", ["-X", "-q", artifactPath, "manifest.json", "agents.json"], {
      cwd: temporary,
      stdio: "inherit",
    });
    if (zipped.status !== 0) throw new Error(`zip failed for ${id}`);
    const artifact = await readFile(artifactPath);
    catalogPackages.push({
      manifest,
      artifact: {
        url: `https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/main/artifacts/${basename(artifactPath)}`,
        sha256: sha256(artifact),
        bytes: artifact.byteLength,
      },
      documentationUrl: `https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/agents/built-in-agents.md#${id}`,
    });
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

await writeFile(join(repoRoot, "catalog/catalog.json"), `${JSON.stringify({
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  packages: catalogPackages,
}, null, 2)}\n`);
