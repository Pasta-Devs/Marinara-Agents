import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..");
const engineRoot = resolve(process.env.MARINARA_ENGINE_ROOT || join(repoRoot, "../Marinara-Engine"));
const artifactsDir = join(repoRoot, "artifacts");
const packagesDir = join(repoRoot, "packages");
const catalogPath = join(repoRoot, "catalog/catalog.json");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const features = [
  {
    id: "hierarchical-maps",
    name: "Hierarchical Maps",
    description: "Adds persistent hierarchical locations, spatial context, map authoring, and movement to Roleplay and Game.",
    kind: ["agent", "maps"],
    modes: ["roleplay", "game"],
    permissions: ["agent-runtime", "chat-read", "chat-write", "network", "prompt-context", "routes", "storage", "ui"],
    serverImport: "packages/server/src/routes/spatial-context.routes.ts",
    serverExport: "spatialContextRoutes",
    prefix: "/api/chats",
  },
  {
    id: "conversation-calls",
    name: "Conversation Calls",
    description: "Adds live audio and video calls with Conversation characters.",
    kind: ["agent", "conversation-calls"],
    modes: ["conversation"],
    permissions: ["agent-runtime", "chat-read", "chat-write", "network", "routes", "storage", "ui"],
    serverImport: "packages/server/src/routes/conversation-calls.routes.ts",
    serverExport: "conversationCallsRoutes",
    prefix: "/api/conversation-calls",
  },
  ...[
    ["uno", "UNO", "Play UNO with Conversation characters."],
    ["chess", "Chess", "Play Chess with a Conversation character."],
    ["poker", "Poker", "Play Texas Hold’em Poker with Conversation characters."],
    ["eightball", "8-Ball Pool", "Play 8-Ball Pool with a Conversation character."],
    ["tic-tac-toe", "Tic-Tac-Toe", "Play Tic-Tac-Toe with a Conversation character."],
    ["rock-paper-scissors", "Rock-Paper-Scissors", "Play Rock-Paper-Scissors with a Conversation character."],
  ].map(([id, name, description]) => ({
    id,
    name,
    description,
    kind: ["agent", "turn-game"],
    modes: ["conversation"],
    permissions: ["agent-runtime", "chat-read", "chat-write", "storage", "ui"],
    engineImport: `packages/shared/src/features/turn-games/${id}/engine.ts`,
    engineExport: id === "eightball" ? "eightBallEngine" : id === "tic-tac-toe" ? "ticTacToeEngine" : id === "rock-paper-scissors" ? "rockPaperScissorsEngine" : `${id}Engine`,
  })),
];

async function bundleServer(feature, output) {
  const temporary = await mkdtemp(join(tmpdir(), `marinara-feature-entry-${feature.id}-`));
  try {
    const target = resolve(engineRoot, feature.serverImport || feature.engineImport);
    const source = feature.serverImport
      ? `import { ${feature.serverExport} as register } from ${JSON.stringify(target)};\nexport async function activate({ app }) { await app.register(register, { prefix: ${JSON.stringify(feature.prefix)} }); }\n`
      : `import { ${feature.engineExport} as engine } from ${JSON.stringify(target)};\nexport async function activate({ api }) { return api.registerTurnGameEngine(engine); }\n`;
    const entry = join(temporary, "entry.mjs");
    await writeFile(entry, source);
    const result = spawnSync("pnpm", [
      "exec", "esbuild", entry,
      "--bundle", "--platform=node", "--format=esm", "--target=node22", "--minify",
      "--banner:js=import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
      "--external:@huggingface/transformers", "--external:onnxruntime-node", "--external:onnxruntime-web", "--external:sharp",
      "--external:pino", "--external:pino-pretty",
      `--outfile=${output}`,
    ], {
      cwd: engineRoot,
      encoding: "utf8",
    });
    if (result.status !== 0) throw new Error(result.stderr || result.stdout || `esbuild failed for ${feature.id}`);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const featureIds = new Set(features.map((feature) => feature.id));
catalog.packages = catalog.packages.filter((entry) => !featureIds.has(entry.manifest.id));

for (const feature of features) {
  const version = "1.0.0";
  const sourceDir = join(packagesDir, feature.id);
  await mkdir(sourceDir, { recursive: true });
  const agentDefinition = {
    id: feature.id,
    name: feature.name,
    description: feature.description,
    author: "Pasta Devs",
    phase: "pre_generation",
    enabledByDefault: false,
    category: "misc",
    runtimeDisabled: true,
    modeAllowlist: feature.modes,
    defaultTools: [],
    defaultSettings: {},
    defaultPromptTemplate: "",
    execution: "feature",
  };
  const agentsBuffer = Buffer.from(`${JSON.stringify([agentDefinition], null, 2)}\n`);
  const serverPath = join(sourceDir, "server.mjs");
  await bundleServer(feature, serverPath);
  const serverBuffer = await readFile(serverPath);
  await writeFile(join(sourceDir, "agents.json"), agentsBuffer);
  const manifest = {
    schemaVersion: 1,
    id: feature.id,
    name: feature.name,
    version,
    description: feature.description,
    engine: { min: "2.2.2", maxExclusive: "3.0.0" },
    kind: feature.kind,
    entrypoints: { agents: "agents.json", server: "server.mjs" },
    files: [
      { path: "agents.json", sha256: sha256(agentsBuffer), bytes: agentsBuffer.byteLength },
      { path: "server.mjs", sha256: sha256(serverBuffer), bytes: serverBuffer.byteLength },
    ],
    permissions: feature.permissions,
    restartRequired: true,
  };
  await writeFile(join(sourceDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  const temporary = await mkdtemp(join(tmpdir(), `marinara-feature-${feature.id}-`));
  try {
    await writeFile(join(temporary, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    await writeFile(join(temporary, "agents.json"), agentsBuffer);
    await writeFile(join(temporary, "server.mjs"), serverBuffer);
    const artifactName = `${feature.id}-${version}.zip`;
    const artifactPath = join(artifactsDir, artifactName);
    await rm(artifactPath, { force: true });
    const zipped = spawnSync("zip", ["-X", "-q", artifactPath, "manifest.json", "agents.json", "server.mjs"], { cwd: temporary });
    if (zipped.status !== 0) throw new Error(`zip failed for ${feature.id}`);
    const artifact = await readFile(artifactPath);
    catalog.packages.push({
      manifest,
      artifact: {
        url: `https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/main/artifacts/${basename(artifactPath)}`,
        sha256: sha256(artifact),
        bytes: artifact.byteLength,
      },
    });
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

catalog.generatedAt = new Date().toISOString();
await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
